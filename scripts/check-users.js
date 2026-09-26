// Verifica users e profiles no PB
const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const pb = new PocketBase('http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io');
pb.autoCancellation(false);

(async () => {
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  console.log('=== USERS ===');
  try {
    const users = await pb.collection('users').getFullList();
    for (const u of users) {
      console.log(JSON.stringify({id: u.id, email: u.email, name: u.name, verified: u.verified, collectionId: u.collectionId}));
    }
  } catch (e) {
    console.log('Err users:', e.message);
  }

  console.log('\n=== PROFILES ===');
  try {
    const profiles = await pb.collection('profiles').getFullList();
    for (const p of profiles) {
      console.log(JSON.stringify({id: p.id, email: p.email, user_id: p.user_id, organization_id: p.organization_id, role: p.role, status: p.status}));
    }
  } catch (e) {
    console.log('Err profiles:', e.message);
  }

  console.log('\n=== ORGANIZATIONS ===');
  try {
    const orgs = await pb.collection('organizations').getFullList();
    for (const o of orgs) {
      console.log(JSON.stringify({id: o.id, name: o.name, slug: o.slug, status: o.status}));
    }
  } catch (e) {
    console.log('Err orgs:', e.message);
  }

  console.log('\n=== Try user auth with users collection ===');
  try {
    pb.autoCancellation(false);
    await pb.collection('users').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
    console.log('Auth users OK:', pb.authStore.model.email);
  } catch (e) {
    console.log('Err users auth:', e.status, e.message);
  }
})();
