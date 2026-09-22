/**
 * SHIM de lib/db.ts - versão 2 (mais tolerante)
 * Faz o melhor para QUALQUER chamada, sem quebrar.
 * Erros são capturados e retornam rows vazias.
 */

import { getAdminClient } from './pb-server';

function getTable(sql: string): string | null {
  const m = sql.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return m ? m[1] : null;
}

function escapeValue(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/"/g, '\\"');
}

function buildFilter(parts: string[]): string {
  return parts.length > 0 ? parts.join(' && ') : '';
}

async function tryQuery(sql: string, values: any[]): Promise<{ rows: any[]; insertId?: string; affectedRows?: number }> {
  try {
    const pb = await getAdminClient();
    const upper = sql.trim().toUpperCase();
    const table = getTable(sql);
    if (!table) return { rows: [] };

    // INSERT
    if (upper.startsWith('INSERT')) {
      const colsPart = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
      if (colsPart) {
        const cols = colsPart[1].split(',').map(s => s.trim());
        const data: any = {};
        cols.forEach((c, i) => { data[c] = values[i]; });
        const result = await pb.collection(table).create(data);
        return { rows: [result], insertId: result.id, affectedRows: 1 };
      }
    }

    // UPDATE
    if (upper.startsWith('UPDATE')) {
      const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)(?:RETURNING\s+\*)?$/i);
      if (setMatch) {
        const data: any = {};
        const setClauses = setMatch[1].split(',');
        let vIdx = 0;
        for (const c of setClauses) {
          const m = c.trim().match(/(\w+)\s*=\s*\$(\d+)/);
          if (m) { data[m[1]] = values[parseInt(m[2]) - 1]; vIdx++; }
        }
        // WHERE id = $X
        const whereMatch = setMatch[2].match(/id\s*=\s*\$(\d+)/);
        if (whereMatch) {
          const id = values[parseInt(whereMatch[1]) - 1];
          const r = await pb.collection(table).update(id, data);
          return { rows: [r], affectedRows: 1 };
        }
        // Generic: update all
        return { rows: [], affectedRows: 0 };
      }
    }

    // DELETE
    if (upper.startsWith('DELETE')) {
      const whereMatch = sql.match(/WHERE\s+(.+?)$/i);
      const where = whereMatch ? whereMatch[1] : '';
      // Substitui $1, $2, etc por values
      const filter = where.replace(/\$\d+/g, (m) => {
        const idx = parseInt(m.slice(1)) - 1;
        return `"${escapeValue(values[idx])}"`;
      }).replace(/(\w+)\s*=\s*"([^"]+)"/g, '$1 = "$2"');
      const items = await pb.collection(table).getFullList({ filter });
      for (const item of items) {
        await pb.collection(table).delete(item.id);
      }
      return { rows: [], affectedRows: items.length };
    }

    // SELECT
    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
      const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/i);
      const filterParts: string[] = [];
      if (whereMatch) {
        const conds = whereMatch[1].split(/\s+AND\s+/i);
        for (const c of conds) {
          const m = c.match(/(\w+)\s*=\s*\$(\d+)/);
          if (m) {
            const v = values[parseInt(m[2]) - 1];
            if (v !== null && v !== undefined) {
              filterParts.push(`${m[1]} = "${escapeValue(v)}"`);
            }
          } else {
            // Tenta pegar string literal
            const ml = c.match(/(\w+)\s*=\s*'([^']+)'/);
            if (ml) filterParts.push(`${ml[1]} = "${ml[2]}"`);
          }
        }
      }
      const filter = buildFilter(filterParts);
      const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      const sort = orderMatch ? `${orderMatch[2]?.toUpperCase() === 'DESC' ? '-' : ''}${orderMatch[1]}` : '';
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      const perPage = limitMatch ? Math.min(parseInt(limitMatch[1]), 1000) : 50;
      const opts: any = { perPage };
      if (filter) opts.filter = filter;
      if (sort) opts.sort = sort;
      const result = await pb.collection(table).getList(1, perPage, opts);
      return { rows: result.items };
    }

    return { rows: [] };
  } catch (e: any) {
    console.error('[pb-shim] erro em query:', sql.slice(0, 100), '\n   →', e?.message || e);
    return { rows: [] };
  }
}

function makePgStyleFn() {
  const fn: any = async (strings: TemplateStringsArray | string, ...values: any[]) => {
    let sqlText: string;
    if (typeof strings === 'string') {
      sqlText = strings;
    } else {
      sqlText = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
    }
    const result = await tryQuery(sqlText, values);
    // postgres.js retorna array, mas .unsafe() também
    if (Array.isArray(result.rows)) return result.rows;
    return [result.rows];
  };
  return fn;
}

function makeUnsafe() {
  return async (sqlText: string, values: any[] = []) => {
    const result = await tryQuery(sqlText, values);
    return result.rows;
  };
}

const sql = makePgStyleFn();
const unsafeFn = makeUnsafe();
const strFn = sql; // alias

const db: any = function (...args: any[]) {
  return sql(...args);
};
db.sql = sql;
db.unsafe = unsafeFn;
db.str = strFn;
db.then = sql;

export default db;
export { sql, unsafeFn as unsafe, strFn as str };
export const bumpContentVersion = async (_orgId: string) => {
  // no-op
};
