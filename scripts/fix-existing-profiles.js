const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function authPB() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  } catch (e) {
    if (e.status === 404) {
      await pb.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
    }
  }
  return pb;
}

async function main() {
  const pb = await authPB();
  console.log('✅ Admin auth OK');

  // 1. List all users
  const users = await pb.collection('users').getList(1, 100);
  console.log(`Found ${users.items.length} users`);

  // 2. List all profiles
  const profiles = await pb.collection('profiles').getList(1, 100);
  console.log(`Found ${profiles.items.length} profiles`);

  // 3. List all orgs
  const orgs = await pb.collection('organizations').getList(1, 100);
  console.log(`Found ${orgs.items.length} organizations`);

  // 4. Para cada user sem profile, criar
  for (const u of users.items) {
    const existingProfile = profiles.items.find(p => p.user_id === u.id);
    if (existingProfile) {
      console.log(`- ${u.email}: profile exists`);
      continue;
    }
    // Sem profile - criar
    const org = orgs.items.find(o => o.owner_id === u.id);
    const orgId = org?.id || null;
    try {
      const profile = await pb.collection('profiles').create({
        user_id: u.id,
        email: u.email,
        full_name: u.name || u.email,
        role: 'manager',
        status: 'active',
        organization_id: orgId,
      });
      console.log(`- ${u.email}: profile created (${profile.id})`);
    } catch (e) {
      console.log(`- ${u.email}: ERROR creating profile: ${e.message}`);
    }
  }
}

main().catch(console.error);
