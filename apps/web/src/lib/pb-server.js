/**
 * Cliente PocketBase server-side para Next.js.
 * Usado em rotas API que antes usavam `lib/db.ts` (postgres).
 *
 * IMPORTANTE: PocketBase é SQLite, então:
 * - IDs são 15 chars (string), não UUID 36 chars
 * - Não tem `RETURNING` (usar expand)
 * - Não tem transactions multi-collection (operações sequenciais)
 * - Arrays viram JSON strings
 */

const PocketBase = require('pocketbase/cjs');

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

// Cliente para uso com admin auth (server-side)
// Cache para não autenticar a cada request
let adminClient = null;
let adminToken = null;
let adminTokenExpires = 0;

async function getAdminClient() {
  const now = Date.now();
  if (adminClient && adminToken && adminTokenExpires > now) {
    return adminClient;
  }

  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD não configurados no .env');
  }

  adminClient = new PocketBase(PB_URL);
  adminClient.autoCancellation(false);

  console.log('[pb-server] Authenticating to:', PB_URL);

  // PocketBase v0.21+: admins foi renomeado para _superusers
  try {
    await adminClient.collection('_superusers').authWithPassword(email, password);
    console.log('[pb-server] ✅ Auth via _superusers OK');
  } catch (e) {
    console.log('[pb-server] _superusers auth failed:', e.status, e.message);
    // Fallback para versões antigas
    if (e.status === 404 || e.message?.includes('not found')) {
      await adminClient.admins.authWithPassword(email, password);
      console.log('[pb-server] ✅ Auth via admins (fallback) OK');
    } else {
      throw e;
    }
  }
  adminToken = adminClient.authStore.token;
  // Tokens PB duram ~14 dias, renovamos a cada 6h para reduzir chamadas de auth
  adminTokenExpires = now + 6 * 60 * 60 * 1000;

  return adminClient;
}

/**
 * Converte ID Postgres UUID (36 chars) para ID PocketBase (15 chars alfanuméricos).
 * Usa crypto.randomBytes para gerar.
 */
function newId() {
  return require('crypto').randomBytes(8).toString('hex').slice(0, 15);
}

/**
 * Normaliza string para slug: lowercase, remove acentos, troca não-alfanumérico por hífen.
 */
function generateSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Helpers genéricos
 */
async function listAll(collection, filter = '', batchSize = 500) {
  const pb = await getAdminClient();
  const result = await pb.collection(collection).getList(1, batchSize, filter ? { filter } : undefined);
  return result.items;
}

async function findOne(collection, filter) {
  const pb = await getAdminClient();
  try {
    return await pb.collection(collection).getFirstListItem(filter, { fields: '*' });
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function findById(collection, id) {
  const pb = await getAdminClient();
  try {
    return await pb.collection(collection).getOne(id);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function create(collection, data) {
  const pb = await getAdminClient();
  return await pb.collection(collection).create(data);
}

async function update(collection, id, data) {
  const pb = await getAdminClient();
  return await pb.collection(collection).update(id, data);
}

async function deleteRecord(collection, id) {
  const pb = await getAdminClient();
  return await pb.collection(collection).delete(id);
}

/**
 * Hash de senha (mesma lib bcryptjs do projeto).
 */
async function hashPassword(plain) {
  const bcrypt = await import('bcryptjs');
  return await bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  const bcrypt = await import('bcryptjs');
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

module.exports = {
  getAdminClient,
  newId,
  generateSlug,
  listAll,
  findOne,
  findById,
  create,
  update,
  deleteRecord,
  hashPassword,
  verifyPassword,
  PB_URL,
};
