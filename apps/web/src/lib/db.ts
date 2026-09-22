/**
 * lib/db.ts agora é redirecionado para o PB shim.
 * Postgres/Neon está fora do ar — todas as queries via sql() vão para o PocketBase.
 *
 * Em produção, o ideal é reescrever as rotas uma-a-uma usando pb-server.js.
 * Este shim existe para destravar o app AGORA sem reescrever 115 rotas.
 */

import * as pbShim from './pb-shim';

export const sql: any = pbShim._sql;
export const sql_unsafe: any = pbShim._unsafe;
export const sql_str: any = pbShim._unsafe;
export default pbShim._default;
export const bumpContentVersion = pbShim.bumpContentVersion;
