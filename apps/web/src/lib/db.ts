/**
 * lib/db.ts - shim v2 com tratamento tolerante
 */

import * as pbShim from './pb-shim';

export const sql: any = pbShim.sql;
export const sql_unsafe: any = pbShim.unsafe;
export const sql_str: any = pbShim.str;
export const db: any = pbShim.default;
export default db;
export const bumpContentVersion = pbShim.bumpContentVersion;
