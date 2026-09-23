const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  try {
    await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
    const u = await pb.collection('users').create({
      email: 'test_signup@x.com',
      password: '12345678',
      passwordConfirm: '12345678',
      emailVisibility: true,
      verified: false
    });
    console.log('OK user:', u.id, u.email);
    await pb.collection('users').delete(u.id);
    console.log('deleted');
  } catch (e) {
    console.log('ERR:', e.status, e.message);
    if (e.data) console.log(JSON.stringify(e.data).slice(0, 500));
  }
})();
