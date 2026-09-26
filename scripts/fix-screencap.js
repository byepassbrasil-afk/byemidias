const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);
(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  const items = await pb.collection('media').getFullList();
  for (const i of items) {
    if (i.type === 'url' && !i.name.match(/\.(png|jpg|jpeg|webp|gif|avif|mp4|webm|mov|avi|wmv|mkv)$/i) && i.name.match(/screen|capture|screenshot/i)) {
      console.log('Fixing:', i.name);
      await pb.collection('media').update(i.id, { type: 'image' });
    }
  }
  console.log('Final:');
  for (const i of (await pb.collection('media').getFullList())) {
    console.log(' -', i.id.slice(0,8), '|', i.type, '|', i.name);
  }
})();
