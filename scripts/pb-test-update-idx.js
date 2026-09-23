const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const col = await pb.collections.getOne('organizations');
  console.log('Index ANTES:', JSON.stringify(col.indexes));

  // Tenta com array de strings
  try {
    const upd = await pb.collections.update(col.id, { indexes: ['CREATE UNIQUE INDEX idx_orgs_slug ON organizations (slug)'] });
    console.log('Update OK. Index DEPOIS:', JSON.stringify(upd.indexes));
  } catch (e) {
    console.log('ERRO 1:', e.message);

    // Tenta com array de objetos
    try {
      const upd2 = await pb.collections.update(col.id, { indexes: [{ sql: 'CREATE UNIQUE INDEX idx_orgs_slug2 ON organizations (slug)' }] });
      console.log('Update 2 OK. Index DEPOIS:', JSON.stringify(upd2.indexes));
    } catch (e2) {
      console.log('ERRO 2:', e2.message);
    }

    // Tenta com chaves adicionais
    try {
      const upd3 = await pb.collections.update(col.id, {
        indexes: [{ name: 'idx_test', sql: 'CREATE INDEX idx_test ON organizations (slug)' }]
      });
      console.log('Update 3 OK. Index DEPOIS:', JSON.stringify(upd3.indexes));
    } catch (e3) {
      console.log('ERRO 3:', e3.message);
    }
  }
})();
