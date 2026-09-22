/**
 * Shim de lib/db que delega chamadas para o PocketBase.
 * NÃO é uma camada de tradução 1:1 de SQL — é um helper que:
 *   1. Detecta comandos como `SELECT name FROM <table> WHERE <field> = '<value>'`
 *   2. Converte para query PB
 *   3. Retorna resultado no formato esperado pelo frontend (array de objetos)
 *
 * Não é completo, é um shim para destravar o dashboard AGORA.
 * Rotas críticas (login, signup, auth/profile) já foram reescritas para PB nativo.
 *
 * Em produção, todas as rotas devem ser migradas para usar pb-server.js diretamente.
 */

import { getAdminClient } from './pb-server';

interface QueryResult {
  rows: any[];
  affectedRows?: number;
  insertId?: string;
}

function parseTableFromSql(sql: string): string | null {
  // FROM <table>
  const m = sql.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return m ? m[1] : null;
}

function parseSimpleWhere(sql: string): Record<string, string> {
  // WHERE field = 'value' AND field2 = 'value2'
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

function buildPbFilter(filters: Record<string, string>): string {
  return Object.entries(filters)
    .map(([k, v]) => `${k} = "${v.replace(/"/g, '\\"')}"`)
    .join(' && ');
}

const sql = async (strings: TemplateStringsArray, ...values: any[]): Promise<QueryResult> => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i+1}` : ''), '');

  // Detecta INSERT ... RETURNING *
  const insertMatch = text.match(/INSERT\s+INTO\s+(\w+)[^V]*VALUES\s*\(([^)]+)\)\s*RETURNING\s+\*/i);
  if (insertMatch) {
    const table = insertMatch[1];
    const params = parseInsertParams(insertMatch[2], values);
    const pb = await getAdminClient();
    const data = buildInsertData(params, values);
    const result = await pb.collection(table).create(data);
    return { rows: [result], affectedRows: 1, insertId: result.id };
  }

  // Detecta UPDATE ... SET field = $1 ... WHERE id = $2
  const updateMatch = text.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)(?:RETURNING\s+\*)?\s*$/i);
  if (updateMatch) {
    return handleUpdate(updateMatch, values);
  }

  // Detecta SELECT
  const selectMatch = text.match(/^\s*SELECT\s+/i);
  if (selectMatch) {
    return handleSelect(text, values);
  }

  // DELETE
  const deleteMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
  if (deleteMatch) {
    return handleDelete(deleteMatch, values);
  }

  console.error('[pb-shim] SQL não suportado:', text);
  return { rows: [] };
};

function parseInsertParams(paramsStr: string, values: any[]) {
  return paramsStr.split(',').map(s => s.trim());
}

function buildInsertData(paramNames: string[], values: any[]): Record<string, any> {
  const data: Record<string, any> = {};
  paramNames.forEach((name, i) => {
    const v = values[i];
    if (v !== undefined) data[name] = v;
  });
  return data;
}

function parseOrderFromUpdate(setPart: string): string {
  return '';
}

async function handleUpdate(match: RegExpMatchArray, values: any[]): Promise<QueryResult> {
  const table = match[1];
  const setPart = match[2];
  const wherePart = match[3];

  const setPairs: Record<string, any> = {};
  // Divide set clauses
  const assignments = setPart.split(',');
  let valueIdx = 0;
  for (const a of assignments) {
    const m = a.trim().match(/(\w+)\s*=\s*\$\d+/);
    if (m) {
      setPairs[m[1]] = values[valueIdx++];
    }
  }
  // WHERE: id = $N
  const whereMatch = wherePart.match(/id\s*=\s*\$(\d+)/);
  if (!whereMatch) {
    console.error('[pb-shim] WHERE sem id no UPDATE:', wherePart);
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

async function handleSelect(sql: string, values: any[]): Promise<QueryResult> {
  const table = parseTableFromSql(sql);
  if (!table) {
    console.error('[pb-shim] não consegui parsear tabela de:', sql.slice(0, 100));
    return { rows: [] };
  }
  const filters = parseSimpleWhere(sql);
  const order = parseOrderBy(sql);
  const limit = parseLimit(sql);
  // Aplica valores nos filtros
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    for (const k of Object.keys(filters)) {
      if (filters[k] === `$${i+1}`) {
        filters[k] = v;
      }
    }
  }
  // Escapa valores e constrói filtro PB
  const filterParts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    const escaped = String(v).replace(/"/g, '\\"');
    filterParts.push(`${k} = "${escaped}"`);
  }
  const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';

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

async function handleDelete(match: RegExpMatchArray, values: any[]): Promise<QueryResult> {
  const table = match[1];
  const filters = parseSimpleWhere(match[0]);
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
  if (!filter) {
    console.error('[pb-shim] DELETE sem WHERE — bloqueado por segurança');
    return { rows: [], affectedRows: 0 };
  }
  try {
    const pb = await getAdminClient();
    const items = await pb.collection(table).getFullList({ filter });
    for (const item of items) {
      await pb.collection(table).delete(item.id);
    }
    return { rows: [], affectedRows: items.length };
  } catch (e: any) {
    console.error(`[pb-shim] DELETE erro:`, e?.message);
    return { rows: [], affectedRows: 0 };
  }
}

const sql_unsafe = sql;
const sql_str = sql_unsafe;

const db = {
  sql,
  unsafe: sql_unsafe,
  str: sql_str,
};

export default db as any;
export { sql as _sql, sql_unsafe as _unsafe };
export const bumpContentVersion = async (organizationId: string) => {
  // No-op: PB não tem triggers; bump é feito via hooks
};
