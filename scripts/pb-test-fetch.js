const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  const auth = await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const col = await pb.collections.getOne('organizations');
  const r = await fetch(process.env.PB_URL + '/api/collections/' + col.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth.token },
    body: JSON.stringify({ indexes: [{ sql: 'CREATE UNIQUE INDEX idx_orgs_slug ON organizations (slug)' }] })
  });
  console.log('STATUS:', r.status);
  console.log('BODY:', await r.text());
})();
