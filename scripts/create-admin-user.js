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
  const pb = new PocketBase(PB_URL);
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

  console.log('👤 Criando/resetando user gwmorata@gmail.com...');
  try {
    // Try to find existing
    let user;
    try {
      user = await pb.collection('users').getFirstListItem('email = "gwmorata@gmail.com"');
      console.log('  Já existe, atualizando senha...');
    } catch (e) {
      console.log('  Não existe, criando...');
    }

    if (user) {
      await pb.collection('users').update(user.id, {
        password: NEW_PASSWORD,
        passwordConfirm: NEW_PASSWORD,
        verified: true,
        emailVisibility: false,
      });
    } else {
      user = await pb.collection('users').create({
        email: 'gwmorata@gmail.com',
        password: NEW_PASSWORD,
        passwordConfirm: NEW_PASSWORD,
        name: 'Gabriel Morata',
        verified: true,
        emailVisibility: false,
      });
    }
    console.log('  ✅ user.id =', user.id);
  } catch (e) {
    console.error('  ❌', e.message);
  }

  console.log('\n👤 Criando/resetando user byemidias@gmail.com...');
  try {
    let user;
    try {
      user = await pb.collection('users').getFirstListItem('email = "byemidias@gmail.com"');
      console.log('  Já existe, atualizando senha...');
    } catch (e) {
      console.log('  Não existe, criando...');
    }

    if (user) {
      await pb.collection('users').update(user.id, {
        password: NEW_PASSWORD,
        passwordConfirm: NEW_PASSWORD,
        verified: true,
      });
    } else {
      user = await pb.collection('users').create({
        email: 'byemidias@gmail.com',
        password: NEW_PASSWORD,
        passwordConfirm: NEW_PASSWORD,
        name: 'ByeMidias',
        verified: true,
      });
    }
    console.log('  ✅ user.id =', user.id);
  } catch (e) {
    console.error('  ❌', e.message);
  }

  // Verifica
  console.log('\n🧪 Testando...');
  for (const email of ['gwmorata@gmail.com', 'byemidias@gmail.com']) {
    try {
      const t = new PocketBase(PB_URL);
      await t.collection('users').authWithPassword(email, NEW_PASSWORD);
      console.log(`  ${email}: ✅ OK`);
    } catch (e) {
      console.log(`  ${email}: ❌ ${e.status} ${e.message}`);
    }
  }

  console.log('\n🧪 Testando o endpoint de login real...');
  const loginRes = await fetch('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'gwmorata@gmail.com', password: NEW_PASSWORD})
  });
  console.log('  /api/auth/login:', loginRes.status);
  console.log('  Body:', (await loginRes.text()).slice(0, 300));
})().catch(e => console.error('Fatal:', e));
