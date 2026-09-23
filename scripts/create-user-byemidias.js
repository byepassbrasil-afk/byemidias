const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const email = 'byemidias@gmail.com';

  // 1. Verifica/cria user
  let user;
  try {
    user = await pb.collection('users').getFirstListItem(`email = "${email}"`);
    console.log('User já existe:', user.id, user.email);
  } catch (e) {
    if (e.status === 404) {
      console.log('User não existe. Criando...');
      user = await pb.collection('users').create({
        email,
        password: 'byemidias12345',
        passwordConfirm: 'byemidias12345',
        emailVisibility: true,
        verified: true,
        name: 'Byemidias Admin',
      });
      console.log('User criado:', user.id, user.email);
    } else {
      throw e;
    }
  }

  // 2. Verifica/cria organização
  let org;
  try {
    org = await pb.collection('organizations').getFirstListItem(`slug = "byemidias"`);
    console.log('Org já existe:', org.id, org.name);
  } catch (e) {
    if (e.status === 404) {
      console.log('Org não existe. Criando...');
      const orgId = require('crypto').randomBytes(8).toString('hex').slice(0, 15);
      org = await pb.collection('organizations').create({
        id: orgId,
        name: 'Byemidias',
        slug: 'byemidias',
        status: 'active',
        plan: 'free',
        max_devices: 10,
      });
      console.log('Org criada:', org.id, org.name);
    } else {
      throw e;
    }
  }

  // 3. Verifica/cria profile
  let profile;
  try {
    profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    console.log('Profile já existe:', profile.id, 'role:', profile.role);
  } catch (e) {
    if (e.status === 404) {
      console.log('Profile não existe. Criando...');
      profile = await pb.collection('profiles').create({
        id: require('crypto').randomBytes(8).toString('hex').slice(0, 15),
        user_id: user.id,
        email: user.email,
        full_name: 'Byemidias Admin',
        role: 'super_admin',
        status: 'active',
        organization_id: org.id,
      });
      console.log('Profile criado:', profile.id, 'role:', profile.role);
    } else {
      throw e;
    }
  }

  // 4. Atualiza owner_id da org
  if (org.owner_id !== user.id) {
    await pb.collection('organizations').update(org.id, { owner_id: user.id });
    console.log('Org owner_id atualizado para user:', user.id);
  }

  console.log('\n=== RESUMO ===');
  console.log('User ID:        ', user.id);
  console.log('User email:     ', user.email);
  console.log('Org ID:         ', org.id);
  console.log('Org name:       ', org.name);
  console.log('Org slug:       ', org.slug);
  console.log('Profile ID:     ', profile.id);
  console.log('Profile role:   ', profile.role);
  console.log('Profile org_id: ', profile.organization_id);
  console.log('Senha:          byemidias12345');
})();
