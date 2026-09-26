const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);
(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  const coll = await pb.collections.getOne('pbc_2708086759'); // media collection
  console.log('Media collection:');
  console.log(JSON.stringify(coll.schema, null, 2));
  console.log('\nLista de mídias (primeiras 5):');
  const items = await pb.collection('media').getList(1, 5, { sort: '-created' });
  for (const i of items.items) {
    console.log(' -', JSON.stringify(i, null, 2));
  }
})();
