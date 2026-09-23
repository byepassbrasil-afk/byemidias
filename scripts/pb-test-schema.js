const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

const SCHEMA = [
  { name: 'name', type: 'text', required: true, options: { min: 1 } },
  { name: 'slug', type: 'text', required: true, options: { min: 1 } },
  { name: 'logo_url', type: 'url' },
  { name: 'status', type: 'text' },
];

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);

  // Deleta e recria para teste limpo
  try { await pb.collections.delete('test_schema'); } catch {}

  console.log('1. Criando collection...');
  const c = await pb.collections.create({ name: 'test_schema', type: 'base', schema: SCHEMA });
  console.log('   schema length no retorno:', c.schema?.length);
  console.log('   schema:', JSON.stringify(c.schema));

  console.log('\n2. Listando collection pelo nome...');
  const c2 = await pb.collections.getOne('test_schema');
  console.log('   schema length:', c2.schema?.length);
  console.log('   schema:', JSON.stringify(c2.schema));

  // Limpa
  await pb.collections.delete('test_schema');
})();
