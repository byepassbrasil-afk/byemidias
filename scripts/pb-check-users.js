const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);

  const users = await pb.collections.getOne('users');
  console.log('users collection:');
  console.log('  type:', users.type);
  console.log('  fields:', JSON.stringify(users.fields.map(f => ({name: f.name, type: f.type, required: f.required})), null, 2));
  console.log('  listRule:', users.listRule);
  console.log('  viewRule:', users.viewRule);
  console.log('  createRule:', users.createRule);
  console.log('  updateRule:', users.updateRule);
  console.log('  deleteRule:', users.deleteRule);
  console.log('  options:', JSON.stringify(users.options || {}, null, 2));
})();
