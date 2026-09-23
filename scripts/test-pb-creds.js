const PocketBase = require('pocketbase/cjs');

async function testCreds(url, email, password, label) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', url);
  console.log('Email:', email);
  console.log('Password:', password);
  try {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);
    await pb.admins.authWithPassword(email, password);
    console.log('✅ Success');
    const cols = await pb.collections.getList(1, 100);
    console.log('Collections:', cols.items.length);
  } catch (e) {
    console.error('❌ Failed:', e.message, e.status || '');
  }
}

async function main() {
  const url = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

  // Try different credentials
  await testCreds(url, 'gwmorata@gmail.com', '@Gaedaam08', 'Default creds');

  // URL-encoded @
  await testCreds(url, 'gwmorata%40gmail.com', '@Gaedaam08', 'URL-encoded @');

  // Different combinations
  await testCreds(url, 'admin@byemidias.com', 'admin123456', 'admin@byemidias.com');

  // Try with the users collection (not admins)
  try {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);
    const users = await pb.collection('users').getList(1, 5);
    console.log('\nUsers collection count:', users.totalItems);
    if (users.items.length > 0) {
      console.log('First user:', JSON.stringify(users.items[0]));
    }
  } catch (e) {
    console.error('Users list failed:', e.message);
  }
}

main();
