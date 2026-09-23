const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const email = 'byemidias@gmail.com';

  // 1. User
  const user = await pb.collection('users').getFirstListItem(`email = "${email}"`);
  console.log('User:', user.id, user.email);

  // 2. Org
  const org = await pb.collection('organizations').getFirstListItem('slug = "byemidias"');
  console.log('Org:', org.id, org.name, 'status:', org.status);

  // 3. Profile - atualizar para super_admin
  let profile;
  try {
    profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    console.log('Profile atual:', profile.id, 'role:', profile.role, 'status:', profile.status);
  } catch (e) {
    console.log('Profile não existe');
  }

  if (profile) {
    await pb.collection('profiles').update(profile.id, {
      role: 'super_admin',
      status: 'active',
    });
    console.log('✓ Profile atualizado para super_admin/active');
  } else {
    profile = await pb.collection('profiles').create({
      id: require('crypto').randomBytes(8).toString('hex').slice(0, 15),
      user_id: user.id,
      email: user.email,
      full_name: 'Byemidias Admin',
      role: 'super_admin',
      status: 'active',
      organization_id: org.id,
    });
    console.log('✓ Profile criado como super_admin');
  }

  // 4. Atualizar org: status active + owner_id
  await pb.collection('organizations').update(org.id, {
    status: 'active',
    owner_id: user.id,
  });
  console.log('✓ Org atualizada para active, owner_id = user');

  // 5. Garantir senha (resetar se necessário)
  await pb.collection('users').update(user.id, {
    password: 'byemidias12345',
    passwordConfirm: 'byemidias12345',
  });
  console.log('✓ Senha resetada para: byemidias12345');

  console.log('\n=== RESUMO FINAL ===');
  console.log('User:        ', user.id, user.email);
  console.log('Org:         ', org.id, org.name);
  console.log('Role:        super_admin');
  console.log('Status:      active');
  console.log('Senha:       byemidias12345');
})();
