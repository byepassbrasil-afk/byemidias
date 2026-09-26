const fs = require('fs');
const path = require('path');
const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');

const env = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8').replace(/\r/g, '');
function getEnv(key) {
  const m = env.match(new RegExp('^' + key + '=(.+)$', 'm'));
  return m ? m[1].trim() : null;
}

const PB_URL = getEnv('PB_URL');
const PB_ADMIN_EMAIL = getEnv('PB_ADMIN_EMAIL');
const PB_ADMIN_PASSWORD = getEnv('PB_ADMIN_PASSWORD');
const NEW_PASSWORD = '@Gaedaam08';

(async () => {
  console.log('🔐 Conectando ao PocketBase:', PB_URL);
  const pb = new PocketBase(PB_URL);

  // Auth via superuser
  console.log('🔐 Auth superuser...');
  try {
    await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('  ✅ Logado');
  } catch (e) {
    console.error('  ❌ Falha no auth:', e.message);
    process.exit(1);
  }

  // Lista superusers
  console.log('\n👑 Superusers:');
  try {
    const supers = await pb.collection('_superusers').getFullList();
    for (const s of supers) {
      console.log(`   - ${s.email} (id=${s.id})`);
      if (s.email === 'gwmorata@gmail.com' && s.email !== PB_ADMIN_EMAIL) {
        try {
          await pb.collection('_superusers').update(s.id, {
            password: NEW_PASSWORD,
            passwordConfirm: NEW_PASSWORD,
          });
          console.log(`     ✅ Senha atualizada`);
        } catch (e) {
          console.log(`     ❌ Erro:`, e.message);
        }
      }
    }
  } catch (e) {
    console.log('  Erro listando:', e.message);
  }

  // Lista users
  console.log('\n👤 Users:');
  try {
    const users = await pb.collection('users').getFullList();
    for (const u of users) {
      console.log(`   - ${u.email} (id=${u.id}, verified=${u.verified})`);
      if (u.email === 'gwmorata@gmail.com' || u.email === 'byemidias@gmail.com') {
        try {
          await pb.collection('users').update(u.id, {
            password: NEW_PASSWORD,
            passwordConfirm: NEW_PASSWORD,
            verified: true,
          });
          console.log(`     ✅ Senha atualizada`);
        } catch (e) {
          console.log(`     ❌ Erro:`, e.message);
        }
      }
    }
  } catch (e) {
    console.log('  Erro listando:', e.message);
  }

  // Verifica
  console.log('\n🧪 Testando login com a senha nova...');
  for (const email of ['gwmorata@gmail.com', 'byemidias@gmail.com']) {
    try {
      const test = new PocketBase(PB_URL);
      await test.collection('users').authWithPassword(email, NEW_PASSWORD);
      console.log(`  users.auth: ${email}: ✅ OK`);
    } catch (e) {
      console.log(`  users.auth: ${email}: ❌ ${e.status || e.message}`);
    }
    try {
      const test = new PocketBase(PB_URL);
      await test.collection('_superusers').authWithPassword(email, NEW_PASSWORD);
      console.log(`  super.auth: ${email}: ✅ OK`);
    } catch (e) {
      console.log(`  super.auth: ${email}: ❌ ${e.status || e.message}`);
    }
  }
})().catch(e => { console.error('Erro fatal:', e); process.exit(1); });
