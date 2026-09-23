const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

const SKIP = new Set(['_admins', '_external_auths', '_mfas', '_otps', '_superusers']);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const r = await pb.collections.getFullList();
  const mine = r.filter(c => !SKIP.has(c.name) && !c.system);
  console.log('Total collections:', mine.length);
  for (const c of mine) {
    console.log(`- ${c.name.padEnd(28)} (${(c.fields || []).length} fields, ${(c.indexes || []).length} indexes)`);
  }
})();

