const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);
(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

  // Achar user gwmorata
  const user = await pb.collection('users').getFirstListItem('email = "gwmorata@gmail.com"');
  console.log('user_id:', user.id);

  // Achar org byemidias
  const org = await pb.collection('organizations').getFirstListItem('slug = "byemidias"');
  console.log('org_id:', org.id);

  // Criar profile de super_admin
  console.log('Criando profile super_admin...');
  try {
    // Check if já existe
    try {
      const existing = await pb.collection('profiles').getFirstListItem('email = "gwmorata@gmail.com"');
      console.log('  Já existe profile, atualizando...');
      await pb.collection('profiles').update(existing.id, {
        user_id: user.id,
        organization_id: org.id,
        email: 'gwmorata@gmail.com',
        full_name: 'Gabriel Morata',
        role: 'super_admin',
        status: 'active',
      });
      console.log('  ✅ Profile atualizado');
    } catch {
      const profile = await pb.collection('profiles').create({
        user_id: user.id,
        organization_id: org.id,
        email: 'gwmorata@gmail.com',
        full_name: 'Gabriel Morata',
        role: 'super_admin',
        status: 'active',
      });
      console.log('  ✅ Profile criado:', profile.id);
    }
  } catch (e) {
    console.error('  ❌', e.message, JSON.stringify(e.data || {}).slice(0, 500));
  }

  // Test login final
  console.log('\n🧪 Test login final:');
  const t = new PocketBase(PB_URL);
  await t.collection('users').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  const loginRes = await fetch('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST', headers: {'Content-Type': 'application/json', 'Cookie': 'session=' + encodeURIComponent(JSON.stringify({email: 'gwmorata@gmail.com'}))},
    body: JSON.stringify({email: 'gwmorata@gmail.com', password: '@Gaedaam08'})
  });
  console.log('  /api/auth/login:', loginRes.status);
  console.log('  Body:', (await loginRes.text()).slice(0, 400));
})();
