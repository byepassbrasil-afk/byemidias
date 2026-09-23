const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';
const email = 'gwmorata@gmail.com';
const password = '@Gaedaam08';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(email, password);

  const testEmail = `test_${Date.now()}@test.com`;

  try {
    // Create user
    const user = await pb.collection('users').create({
      email: testEmail,
      password: 'Test123456',
      passwordConfirm: 'Test123456',
      emailVisibility: true,
      verified: true,
    });
    console.log('✅ User created:', user.id, user.email);

    // Create org
    const org = await pb.collection('organizations').create({
      name: 'Test Company',
      slug: `test-${Date.now()}`,
      status: 'active',
      plan: 'free',
      max_devices: 10,
    });
    console.log('✅ Org created:', org.id, org.name);

    // Create profile
    const profile = await pb.collection('profiles').create({
      user_id: user.id,
      email: testEmail,
      full_name: 'Test User',
      role: 'admin',
      status: 'active',
      organization_id: org.id,
    });
    console.log('✅ Profile created:', profile.id);

    // Update org owner
    await pb.collection('organizations').update(org.id, { owner_id: user.id });
    console.log('✅ Org owner updated');

    // Test login
    const loginPb = new PocketBase(PB_URL);
    await loginPb.collection('users').authWithPassword(testEmail, 'Test123456');
    console.log('✅ Login works!');

    console.log('\n📋 Test credentials:');
    console.log('   Email:', testEmail);
    console.log('   Password: Test123456');

  } catch (e) {
    console.error('❌ Error:', e.message);
    if (e.data) console.error('   Data:', JSON.stringify(e.data));
  }
}

main();
