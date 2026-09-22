/**
 * Shim de lib/db que delega chamadas para o PocketBase.
 * Detecta padrões SQL comuns e traduz para queries PB.
 */

import { getAdminClient } from './pb-server';

interface QueryResult {
  rows: any[];
  affectedRows?: number;
  insertId?: string;
}

function parseTableFromSql(sql: string): string | null {
  const m = sql.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return m ? m[1] : null;
}

function parseSimpleWhere(sql: string): Record<string, string> {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/i);
  if (!whereMatch) return {};
  const conds = whereMatch[1].split(/\s+AND\s+/i);
  const out: Record<string, string> = {};
  for (const c of conds) {
    const m = c.match(/(\w+)\s*=\s*'?([^']+?)'?(?:\s|$)/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function parseOrderBy(sql: string): string | null {
  const m = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (!m) return null;
  return `${m[2]?.toLowerCase() === 'desc' ? '-' : ''}${m[1]}`;
}

function parseLimit(sql: string): number {
  const m = sql.match(/LIMIT\s+(\d+)/i);
  return m ? parseInt(m[1]) : 50;
}

const sql = async (strings: TemplateStringsArray, ...values: any[]): Promise<QueryResult> => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i+1}` : ''), '');

  // INSERT ... RETURNING *
  const insertMatch = text.match(/INSERT\s+INTO\s+(\w+)[^V]*VALUES\s*\(([^)]+)\)\s*RETURNING\s+\*/i);
  if (insertMatch) {
    const table = insertMatch[1];
    const paramNames = insertMatch[2].split(',').map(s => s.trim());
    const data: Record<string, any> = {};
    paramNames.forEach((name, i) => {
      const v = values[i];
      if (v !== undefined && v !== null) data[name] = v;
    });
    try {
      const pb = await getAdminClient();
      const result = await pb.collection(table).create(data);
      return { rows: [result], affectedRows: 1, insertId: result.id };
    } catch (e: any) {
      console.error(`[pb-shim] INSERT erro em ${table}:`, e?.message);
      return { rows: [], affectedRows: 0 };
    }
  }

  // UPDATE ... SET ... WHERE id = $N
  const updateMatch = text.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)(?:RETURNING\s+\*)?\s*$/i);
  if (updateMatch) {
    const table = updateMatch[1];
    const setPart = updateMatch[2];
    const wherePart = updateMatch[3];

    const setPairs: Record<string, any> = {};
    const assignments = setPart.split(',');
    let valueIdx = 0;
    for (const a of assignments) {
      const m = a.trim().match(/(\w+)\s*=\s*\$\d+/);
      if (m) {
        setPairs[m[1]] = values[valueIdx++];
      }
    }
    const whereMatch = wherePart.match(/id\s*=\s*\$(\d+)/);
    if (!whereMatch) {
      return { rows: [], affectedRows: 0 };
    }
    const idValue = values[parseInt(whereMatch[1]) - 1];
    try {
      const pb = await getAdminClient();
      const result = await pb.collection(table).update(idValue, setPairs);
      return { rows: [result], affectedRows: 1 };
    } catch (e: any) {
      console.error(`[pb-shim] UPDATE erro em ${table}:`, e?.message);
      return { rows: [], affectedRows: 0 };
    }
  }

  // SELECT
  if (text.trim().toUpperCase().startsWith('SELECT')) {
    return handleSelect(text, values);
  }

  // DELETE
  const deleteMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
  if (deleteMatch) {
    return handleDelete(text, values);
  }

  console.error('[pb-shim] SQL não suportado:', text.slice(0, 100));
  return { rows: [] };
};

async function handleSelect(sql: string, values: any[]): Promise<QueryResult> {
  const table = parseTableFromSql(sql);
  if (!table) return { rows: [] };

  const filters = parseSimpleWhere(sql);
  for (let i = 0; i < values.length; i++) {
    for (const k of Object.keys(filters)) {
      if (filters[k] === `$${i+1}`) filters[k] = values[i];
    }
  }
  const filterParts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    const escaped = String(v).replace(/"/g, '\\"');
    filterParts.push(`${k} = "${escaped}"`);
  }
  const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';
  const order = parseOrderBy(sql);
  const limit = parseLimit(sql);

  try {
    const pb = await getAdminClient();
    const opts: any = { perPage: limit };
    if (filter) opts.filter = filter;
    if (order) opts.sort = order;
    const result = await pb.collection(table).getList(1, limit, opts);
    return { rows: result.items };
  } catch (e: any) {
    console.error(`[pb-shim] SELECT erro em ${table}:`, e?.message);
    return { rows: [] };
  }
}

async function handleDelete(sql: string, values: any[]): Promise<QueryResult> {
  const table = parseTableFromSql(sql);
  if (!table) return { rows: [] };
  const filters = parseSimpleWhere(sql);
  for (let i = 0; i < values.length; i++) {
    for (const k of Object.keys(filters)) {
      if (filters[k] === `$${i+1}`) filters[k] = values[i];
    }
  }
  const filterParts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    const escaped = String(v).replace(/"/g, '\\"');
    filterParts.push(`${k} = "${escaped}"`);
  }
  const filter = filterParts.join(' && ');
  if (!filter) return { rows: [], affectedRows: 0 };
  try {
    const pb = await getAdminClient();
    const items = await pb.collection(table).getFullList({ filter });
    for (const item of items) await pb.collection(table).delete(item.id);
    return { rows: [], affectedRows: items.length };
  } catch (e: any) {
    console.error(`[pb-shim] DELETE erro:`, e?.message);
    return { rows: [], affectedRows: 0 };
  }
}

const sql_unsafe = sql;
const sql_str = sql_unsafe;

const db = { sql, unsafe: sql_unsafe, str: sql_str };

export default db as any;
export { sql as _sql, sql_unsafe as _unsafe };
export const _default = db as any;
export const bumpContentVersion = async (_orgId: string) => {
  // No-op: PB não tem triggers
};
