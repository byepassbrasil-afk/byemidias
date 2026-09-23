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
    } else {
      throw e;
    }
  }
  return pb;
}

async function main() {
  const pb = await authPB();

  // Verifica schema de algumas collections chave
  const checkCollections = ['organizations', 'profiles', 'devices', 'media', 'campaigns', 'playlists'];

  for (const name of checkCollections) {
    try {
      const col = await pb.collections.getOne(name);
      console.log(`\n📋 ${name} (${col.id}):`);
      console.log(`   Type: ${col.type}`);
      console.log(`   Fields: ${col.schema.map(f => f.name).join(', ')}`);
    } catch (e) {
      console.log(`❌ ${name}: ${e.message}`);
    }
  }

  // Tenta criar um usuário de teste
  console.log('\n\nTestando criar user de teste...');
  const testEmail = `test_${Date.now()}@byemidias.com`;
  try {
    const user = await pb.collection('users').create({
      email: testEmail,
      password: 'Test123456',
      passwordConfirm: 'Test123456',
      emailVisibility: true,
      verified: true,
    });
    console.log('✅ User criado:', user.id, user.email);

    // Cria organization
    const org = await pb.collection('organizations').create({
      name: 'Test Org',
      slug: `test-${Date.now()}`,
      status: 'active',
      plan: 'free',
      max_devices: 5,
      owner_id: user.id,
    });
    console.log('✅ Org criada:', org.id);

    // Cria profile
    const profile = await pb.collection('profiles').create({
      user_id: user.id,
      email: testEmail,
      full_name: 'Test User',
      role: 'admin',
      status: 'active',
      organization_id: org.id,
    });
    console.log('✅ Profile criado:', profile.id);

    console.log('\n🎉 Tudo funciona!');
    console.log('   Login:', testEmail, '/ Test123456');
  } catch (e) {
    console.error('❌ Erro:', e.message);
    if (e.data) console.error('   Data:', JSON.stringify(e.data).slice(0, 300));
  }
}

main();
