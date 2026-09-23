const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';
const email = 'gwmorata@gmail.com';
const password = '@Gaedaam08';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(email, password);
  console.log('✅ Admin auth OK');

  // Create organizations collection
  try {
    const orgs = await pb.collections.create({
      name: 'organizations',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'status', type: 'select', options: { values: ['active', 'pending_approval', 'suspended'] } },
        { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'pro', 'enterprise'] } },
        { name: 'max_devices', type: 'number' },
        { name: 'owner_id', type: 'text' },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    });
    console.log('✅ Organizations collection created:', orgs.id);
  } catch (e) {
    if (e.message?.includes('already exists')) {
      console.log('⚠️  Organizations collection already exists');
    } else {
      console.error('❌ Organizations error:', e.message);
    }
  }

  // Create profiles collection
  try {
    const profiles = await pb.collections.create({
      name: 'profiles',
      type: 'base',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'email', type: 'text', required: true },
        { name: 'full_name', type: 'text' },
        { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer'] } },
        { name: 'status', type: 'select', options: { values: ['active', 'pending_invite', 'suspended'] } },
        { name: 'organization_id', type: 'text' },
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    });
    console.log('✅ Profiles collection created:', profiles.id);
  } catch (e) {
    if (e.message?.includes('already exists')) {
      console.log('⚠️  Profiles collection already exists');
    } else {
      console.error('❌ Profiles error:', e.message);
    }
  }

  console.log('\n✅ Collections setup complete!');
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
