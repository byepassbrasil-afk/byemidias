const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';
const email = 'gwmorata@gmail.com';
const password = '@Gaedaam08';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(email, password);

  try {
    const collections = await pb.collections.getList(1, 100);
    console.log('📋 Collections:');
    collections.items.forEach(c => {
      console.log(`  - ${c.name} (type: ${c.type})`);
    });
  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  // Try users
  try {
    const users = await pb.collection('users').getList(1, 5);
    console.log('\n📋 Users:', users.totalItems);
    users.items.forEach(u => console.log('  -', u.email, '| verified:', u.verified));
  } catch (e) {
    console.error('❌ Users error:', e.message);
  }
}

main().catch(e => { console.error('Erro:', e.message); });
