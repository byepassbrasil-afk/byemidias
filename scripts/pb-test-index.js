const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);

  // Tenta criar uma collection com índice
  try {
    const c = await pb.collections.create({
      name: '_test_index_2',
      type: 'base',
      fields: [{ name: 'name', type: 'text' }],
      indexes: ['CREATE INDEX idx_test_name ON _test_index_2 (name)']
    });
    console.log('criou com sucesso!');
    console.log('indexes retornados:', JSON.stringify(c.indexes));
    // Limpa
    await pb.collections.delete(c.id);
  } catch (e) {
    console.log('ERRO:', e.message, JSON.stringify(e.data).slice(0, 500));
  }
})();
