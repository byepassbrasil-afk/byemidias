const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io');
pb.autoCancellation(false);
async function main() {
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  // Lista todos os devices
  const all = await pb.collection('devices').getList(1, 500);
  console.log('Total devices:', all.items.length);
  for (const d of all.items) {
    console.log(' -', d.id, d.name, '| device_uuid:', d.device_uuid);
  }

  // Testa o filter
  console.log('---');
  const filterValue = 'test-device-uuid-1790188248562';
  const list = await pb.collection('devices').getList(1, 5, {
    filter: `device_uuid = "${filterValue}"`,
  });
  console.log('Items com device_uuid = test:', list.items.length);
  for (const d of list.items) {
    console.log(' -', d.id, d.device_uuid);
  }
}

main().catch(console.error);
