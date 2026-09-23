const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  try {
    const u = await pb.collection('users').getFirstListItem('email = "byemidias_user1@byemidias.com"');
    console.log('Current user:', u.email, 'verified:', u.verified);
    if (!u.verified) {
      await pb.collection('users').update(u.id, { verified: true });
      console.log('Updated verified=true');
    }
  } catch (e) {
    console.log('ERRO:', e.message);
  }
})();
