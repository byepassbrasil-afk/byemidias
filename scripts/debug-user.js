const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io');
pb.autoCancellation(false);
async function main() {
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  const userId = 'uma08wxbz18l1rg'; // user do deploytest
  try {
    const profile = await pb.collection('profiles').getFirstListItem(`user_id = "${userId}"`);
    console.log('Profile found:', JSON.stringify(profile, null, 2));
  } catch (e) {
    console.log('Error:', e.status, e.message, JSON.stringify(e.data));
  }
}
main().catch(console.error);
