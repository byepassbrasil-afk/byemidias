const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  const collectionsToFix = {
    activation_codes: ['organization_id'],
    partner_devices: ['organization_id'],
    device_group_members: ['organization_id'],
    device_categories: ['organization_id'],
    advertiser_devices: ['organization_id'],
    device_overrides: ['organization_id'],
    organization_admins: [],  // já tem user_id e organization_id
    playback_logs: ['organization_id'],
    device_logs: ['organization_id'],
    device_uptime_sessions: ['organization_id'],
    keepalive_log: ['organization_id'],
    activation_codes: ['organization_id'],
  };

  for (const [name, fieldsToAdd] of Object.entries(collectionsToFix)) {
    try {
      const col = await pb.collections.getOne(name);
      const existingNames = new Set(col.fields.map(f => f.name));

      const newFields = fieldsToAdd
        .filter(f => !existingNames.has(f))
        .map(f => ({ name: f, type: 'text' }));

      if (newFields.length === 0) {
        console.log(`${name}: já tem todos os campos`);
        continue;
      }

      const allFields = [...col.fields, ...newFields];
      await pb.collections.update(col.id, { fields: allFields });
      console.log(`✅ ${name}: +${newFields.length} campos (${allFields.length} total)`);
    } catch (e) {
      console.error(`❌ ${name}:`, e.message);
    }
  }
}

main().catch(console.error);
