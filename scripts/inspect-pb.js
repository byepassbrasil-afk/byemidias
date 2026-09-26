const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);
(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  const profiles = await pb.collection('profiles').getFullList({ perPage: 20 });
  console.log('Profiles existentes:', profiles.length);
  for (const p of profiles) {
    console.log('  -', p.email, '|', p.role, '|', p.organization_id, '| user_id=' + p.user_id);
  }
  const orgs = await pb.collection('organizations').getFullList({ perPage: 20 });
  console.log('\nOrgs:', orgs.length);
  for (const o of orgs) {
    console.log('  -', o.name, '|', o.id, '|', o.slug);
  }
  const users = await pb.collection('users').getFullList({ perPage: 5, filter: 'email = "gwmorata@gmail.com"' });
  console.log('\nUsers gwmorata:', JSON.stringify(users, null, 2));
})();
