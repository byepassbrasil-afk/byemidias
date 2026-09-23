// Teste rápido de conexão com PocketBase
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://2.25.238.133:32769');

(async () => {
  try {
    const health = await pb.health.check();
    console.log('✓ Health:', JSON.stringify(health));
  } catch (e) {
    console.log('✗ Health failed:', e.message);
  }

  // Listar admins
  try {
    const admins = await pb.admins.getList(1, 5);
    console.log('✓ Admins found:', admins.totalItems);
  } catch (e) {
    console.log('✗ List admins failed:', e.message);
  }

  // Tentar autenticar
  try {
    await pb.admins.authWithPassword('admin@byemidias.com', 'admin12345');
    console.log('✓ Admin auth OK');
  } catch (e) {
    console.log('✗ Admin auth failed:', e.status, e.message);
  }

  // Tentar listar collections
  try {
    const cols = await pb.collections.getList(1, 100);
    console.log('✓ Collections:', cols.items.map(c => c.name).join(', ') || 'nenhuma');
  } catch (e) {
    console.log('✗ List collections failed:', e.status, e.message);
  }
})();
