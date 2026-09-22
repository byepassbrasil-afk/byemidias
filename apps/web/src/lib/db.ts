/**
 * lib/db.ts agora é redirecionado para o PB shim.
 * Postgres/Neon está fora do ar — todas as queries via sql() vão para o PocketBase.
 *
 * Em produção, o ideal é reescrever as rotas uma-a-uma usando pb-server.js.
 * Este shim existe para destravar o app AGORA sem reescrever 115 rotas.
 */

export { default, sql, sql_unsafe, sql_str, bumpContentVersion } from './pb-shim';
export * from './pb-shim';
