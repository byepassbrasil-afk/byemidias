const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  // Test signup
  const pb = new PocketBase(PB_URL);

  const email = `test_${Date.now()}@test.com`;
  const password = 'Test123456';

  console.log('Testing signup...');

  // We need to use admin to create user
  const admin = new PocketBase(PB_URL);
  await admin.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  try {
    // Create user in users collection
    const user = await admin.collection('users').create({
      email: email,
      password: password,
      passwordConfirm: password,
      emailVisibility: true,
    });
    console.log('✅ User created:', user.id, user.email);

    // Create profile
    const profile = await admin.collection('profiles').create({
      user_id: user.id,
      email: email,
      full_name: 'Test User',
      role: 'manager',
      status: 'active',
    });
    console.log('✅ Profile created:', profile.id);

    // Create org
    const org = await admin.collection('organizations').create({
      name: 'Test Company',
      slug: `test-company-${Date.now()}`,
      status: 'active',
      plan: 'free',
      max_devices: 3,
    });
    console.log('✅ Organization created:', org.id);

    // Link profile to org
    await admin.collection('profiles').update(profile.id, { organization_id: org.id });
    console.log('✅ Profile linked to org');

    console.log('\n📋 Test credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

main().catch(e => { console.error('Erro fatal:', e.message); });
