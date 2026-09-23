const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function authPB() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  return pb;
}

async function main() {
  const pb = await authPB();

  const collections = [
    {
      name: 'organizations',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'status', type: 'text' },
        { name: 'plan', type: 'text' },
        { name: 'max_devices', type: 'number' },
        { name: 'owner_id', type: 'text' },
      ],
    },
    {
      name: 'profiles',
      fields: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'email', type: 'text', required: true },
        { name: 'full_name', type: 'text' },
        { name: 'role', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'organization_id', type: 'text' },
      ],
    },
    {
      name: 'devices',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'organization_id', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'last_heartbeat', type: 'date' },
        { name: 'location_lat', type: 'number' },
        { name: 'location_lng', type: 'number' },
        { name: 'location_name', type: 'text' },
        { name: 'model', type: 'text' },
        { name: 'campaign_id', type: 'text' },
      ],
    },
    {
      name: 'media',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'organization_id', type: 'text' },
        { name: 'url', type: 'text' },
        { name: 'type', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'duration', type: 'number' },
      ],
    },
    {
      name: 'campaigns',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'organization_id', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'start_date', type: 'date' },
        { name: 'end_date', type: 'date' },
      ],
    },
    {
      name: 'playlists',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'organization_id', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'approved_at', type: 'date' },
      ],
    },
  ];

  for (const col of collections) {
    try {
      const result = await pb.collections.create({
        name: col.name,
        type: 'base',
        fields: col.fields,
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
      });
      console.log(`✅ ${col.name} created with ${result.fields.length - 1} custom fields`);
    } catch (e) {
      console.log(`❌ ${col.name}:`, e.message);
      console.log(`   Data:`, JSON.stringify(e.data, null, 2).slice(0, 300));
    }
  }
}

main().catch(console.error);
