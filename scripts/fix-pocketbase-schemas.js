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
    }
  }
  return pb;
}

const collectionsToCreate = [
  {
    name: 'organizations',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'status', type: 'select', options: { values: ['active', 'pending_approval', 'suspended'], maxSelect: 1 } },
      { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'pro', 'enterprise'], maxSelect: 1 } },
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
      { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer', 'super_admin'], maxSelect: 1 } },
      { name: 'status', type: 'select', options: { values: ['active', 'pending_invite', 'suspended'], maxSelect: 1 } },
      { name: 'organization_id', type: 'text' },
    ],
  },
  {
    name: 'devices',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['online', 'offline', 'pending'], maxSelect: 1 } },
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
      { name: 'type', type: 'select', options: { values: ['image', 'video', 'html'], maxSelect: 1 } },
      { name: 'status', type: 'select', options: { values: ['active', 'blocked'], maxSelect: 1 } },
      { name: 'duration', type: 'number' },
    ],
  },
  {
    name: 'campaigns',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['draft', 'active', 'paused', 'finished'], maxSelect: 1 } },
      { name: 'start_date', type: 'date' },
      { name: 'end_date', type: 'date' },
    ],
  },
  {
    name: 'playlists',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['draft', 'active', 'pending_approval'], maxSelect: 1 } },
      { name: 'approved_at', type: 'date' },
    ],
  },
];

const fieldsToAdd = {
  playlist_items: [
    { name: 'playlist_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'order_index', type: 'number' },
  ],
  playlist_slots: [
    { name: 'playlist_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'slot_index', type: 'number' },
    { name: 'duration', type: 'number' },
  ],
  campaign_playlists: [
    { name: 'campaign_id', type: 'text' },
    { name: 'playlist_id', type: 'text' },
  ],
  campaign_targets: [
    { name: 'campaign_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ],
  campaign_time_slots: [
    { name: 'campaign_id', type: 'text' },
    { name: 'playlist_id', type: 'text' },
    { name: 'day_of_week', type: 'number' },
    { name: 'start_time', type: 'text' },
    { name: 'end_time', type: 'text' },
  ],
  campaign_calendar: [
    { name: 'campaign_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'date', type: 'date' },
  ],
  content_schedules: [
    { name: 'playlist_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'start_time', type: 'text' },
    { name: 'end_time', type: 'text' },
  ],
  device_groups: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ],
  device_group_members: [
    { name: 'device_group_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ],
  device_logs: [
    { name: 'device_id', type: 'text' },
    { name: 'campaign_id', type: 'text' },
    { name: 'event', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ],
  device_uptime_sessions: [
    { name: 'device_id', type: 'text' },
    { name: 'started_at', type: 'date' },
    { name: 'ended_at', type: 'date' },
  ],
  activation_codes: [
    { name: 'code', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'linked_device_id', type: 'text' },
    { name: 'used', type: 'bool' },
    { name: 'expires_at', type: 'date' },
  ],
  partner_access: [
    { name: 'partner_id', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer'], maxSelect: 1 } },
  ],
  partner_devices: [
    { name: 'partner_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ],
  partner_payments: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'select', options: { values: ['pending', 'paid', 'failed'], maxSelect: 1 } },
    { name: 'due_date', type: 'date' },
  ],
  partner_invoices: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'select', options: { values: ['pending', 'paid'], maxSelect: 1 } },
    { name: 'due_date', type: 'date' },
  ],
  partner_media_uploads: [
    { name: 'partner_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['pending', 'approved', 'rejected'], maxSelect: 1 } },
  ],
  playback_logs: [
    { name: 'device_id', type: 'text' },
    { name: 'campaign_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ],
  keepalive_log: [
    { name: 'device_id', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ],
  layout_templates: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'config', type: 'json' },
  ],
  advertiser_devices: [
    { name: 'advertiser_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ],
  advertisers: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ],
  device_categories: [
    { name: 'device_id', type: 'text' },
    { name: 'category_id', type: 'text' },
  ],
  categories: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'slug', type: 'text' },
  ],
  device_overrides: [
    { name: 'device_id', type: 'text' },
    { name: 'media_id', type: 'text' },
  ],
  organization_admins: [
    { name: 'organization_id', type: 'text' },
    { name: 'user_id', type: 'text' },
  ],
  push_subscriptions: [
    { name: 'user_id', type: 'text' },
    { name: 'endpoint', type: 'text' },
    { name: 'keys', type: 'json' },
  ],
  revenues: [
    { name: 'campaign_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'date', type: 'date' },
  ],
  units: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ],
  partners: [
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['active', 'inactive'], maxSelect: 1 } },
  ],
};

async function main() {
  const pb = await authPB();
  console.log('✅ Admin auth OK\n');

  // 1. Verifica collections existentes
  const existing = await pb.collections.getList(1, 100);
  const existingMap = new Map(existing.items.map(c => [c.name, c]));

  // 2. Cria collections que não existem
  console.log('=== Criando collections faltantes ===');
  for (const col of collectionsToCreate) {
    if (existingMap.has(col.name)) {
      console.log(`⚠️  ${col.name} já existe, pulando`);
      continue;
    }
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
      console.log(`✅ ${col.name} criada (${result.fields.length} fields)`);
    } catch (e) {
      console.log(`❌ ${col.name}:`, e.message);
    }
  }

  // 3. Adiciona campos faltantes via update
  console.log('\n=== Atualizando collections existentes ===');
  for (const [name, fields] of Object.entries(fieldsToAdd)) {
    const col = existingMap.get(name);
    if (!col) continue;

    const currentFields = col.fields || [];
    const existingFieldNames = new Set(currentFields.map(f => f.name));
    const newFields = fields.filter(f => !existingFieldNames.has(f.name));

    if (newFields.length === 0) {
      console.log(`✓ ${name} já tem todos os campos`);
      continue;
    }

    const allFields = [
      ...currentFields,
      ...newFields,
    ];

    try {
      await pb.collections.update(col.id, { fields: allFields });
      console.log(`✅ ${name}: +${newFields.length} campos (${allFields.length} total)`);
    } catch (e) {
      console.log(`❌ ${name}: ${e.message} - tentando com required false`);
      // Tenta com required false em todos
      try {
        const safeFields = allFields.map(f => ({ ...f, required: false }));
        await pb.collections.update(col.id, { fields: safeFields });
        console.log(`✅ ${name}: OK com required false`);
      } catch (e2) {
        console.log(`❌ ${name} final:`, e2.data?.data || e2.message);
      }
    }
  }

  console.log('\n✅ Finalizado!');
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
