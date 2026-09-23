const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';
const EMAIL = 'gwmorata@gmail.com';
const PASSWORD = '@Gaedaam08';

async function authPB() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection('_superusers').authWithPassword(EMAIL, PASSWORD);
  } catch (e) {
    if (e.status === 404) {
      await pb.admins.authWithPassword(EMAIL, PASSWORD);
    } else {
      throw e;
    }
  }
  return pb;
}

// Definir todas as collections com schema completo
const collections = [
  {
    name: 'organizations',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'status', type: 'select', options: { values: ['active', 'pending_approval', 'suspended'] } },
      { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'pro', 'enterprise'] } },
      { name: 'max_devices', type: 'number' },
      { name: 'owner_id', type: 'text' },
    ]
  },
  {
    name: 'profiles',
    type: 'base',
    schema: [
      { name: 'user_id', type: 'text', required: true },
      { name: 'email', type: 'text', required: true },
      { name: 'full_name', type: 'text' },
      { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer', 'super_admin'] } },
      { name: 'status', type: 'select', options: { values: ['active', 'pending_invite', 'suspended'] } },
      { name: 'organization_id', type: 'text' },
    ]
  },
  {
    name: 'devices',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['online', 'offline', 'pending'] } },
      { name: 'last_heartbeat', type: 'date' },
      { name: 'location_lat', type: 'number' },
      { name: 'location_lng', type: 'number' },
      { name: 'location_name', type: 'text' },
      { name: 'model', type: 'text' },
      { name: 'campaign_id', type: 'text' },
    ]
  },
  {
    name: 'media',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'url', type: 'text' },
      { name: 'type', type: 'select', options: { values: ['image', 'video', 'html'] } },
      { name: 'status', type: 'select', options: { values: ['active', 'blocked'] } },
      { name: 'duration', type: 'number' },
    ]
  },
  {
    name: 'campaigns',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['draft', 'active', 'paused', 'finished'] } },
      { name: 'start_date', type: 'date' },
      { name: 'end_date', type: 'date' },
    ]
  },
  {
    name: 'playlists',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['draft', 'active', 'pending_approval'] } },
      { name: 'approved_at', type: 'date' },
    ]
  },
  {
    name: 'playlist_items',
    type: 'base',
    schema: [
      { name: 'playlist_id', type: 'text' },
      { name: 'media_id', type: 'text' },
      { name: 'order_index', type: 'number' },
    ]
  },
  {
    name: 'playlist_slots',
    type: 'base',
    schema: [
      { name: 'playlist_id', type: 'text' },
      { name: 'media_id', type: 'text' },
      { name: 'slot_index', type: 'number' },
      { name: 'duration', type: 'number' },
    ]
  },
  {
    name: 'campaign_playlists',
    type: 'base',
    schema: [
      { name: 'campaign_id', type: 'text' },
      { name: 'playlist_id', type: 'text' },
    ]
  },
  {
    name: 'campaign_targets',
    type: 'base',
    schema: [
      { name: 'campaign_id', type: 'text' },
      { name: 'device_id', type: 'text' },
      { name: 'organization_id', type: 'text' },
    ]
  },
  {
    name: 'campaign_time_slots',
    type: 'base',
    schema: [
      { name: 'campaign_id', type: 'text' },
      { name: 'playlist_id', type: 'text' },
      { name: 'day_of_week', type: 'number' },
      { name: 'start_time', type: 'text' },
      { name: 'end_time', type: 'text' },
    ]
  },
  {
    name: 'campaign_calendar',
    type: 'base',
    schema: [
      { name: 'campaign_id', type: 'text' },
      { name: 'device_id', type: 'text' },
      { name: 'date', type: 'date' },
    ]
  },
  {
    name: 'content_schedules',
    type: 'base',
    schema: [
      { name: 'playlist_id', type: 'text' },
      { name: 'device_id', type: 'text' },
      { name: 'start_time', type: 'text' },
      { name: 'end_time', type: 'text' },
    ]
  },
  {
    name: 'device_groups',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
    ]
  },
  {
    name: 'device_group_members',
    type: 'base',
    schema: [
      { name: 'device_group_id', type: 'text' },
      { name: 'device_id', type: 'text' },
    ]
  },
  {
    name: 'device_logs',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'campaign_id', type: 'text' },
      { name: 'event', type: 'text' },
      { name: 'timestamp', type: 'date' },
    ]
  },
  {
    name: 'device_uptime_sessions',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'started_at', type: 'date' },
      { name: 'ended_at', type: 'date' },
    ]
  },
  {
    name: 'activation_codes',
    type: 'base',
    schema: [
      { name: 'code', type: 'text' },
      { name: 'device_id', type: 'text' },
      { name: 'linked_device_id', type: 'text' },
      { name: 'used', type: 'bool' },
      { name: 'expires_at', type: 'date' },
    ]
  },
  {
    name: 'partner_access',
    type: 'base',
    schema: [
      { name: 'partner_id', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer'] } },
    ]
  },
  {
    name: 'partner_devices',
    type: 'base',
    schema: [
      { name: 'partner_id', type: 'text' },
      { name: 'device_id', type: 'text' },
    ]
  },
  {
    name: 'partner_payments',
    type: 'base',
    schema: [
      { name: 'partner_id', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'status', type: 'select', options: { values: ['pending', 'paid', 'failed'] } },
      { name: 'due_date', type: 'date' },
    ]
  },
  {
    name: 'partner_invoices',
    type: 'base',
    schema: [
      { name: 'partner_id', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'status', type: 'select', options: { values: ['pending', 'paid'] } },
      { name: 'due_date', type: 'date' },
    ]
  },
  {
    name: 'partner_media_uploads',
    type: 'base',
    schema: [
      { name: 'partner_id', type: 'text' },
      { name: 'media_id', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['pending', 'approved', 'rejected'] } },
    ]
  },
  {
    name: 'playback_logs',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'campaign_id', type: 'text' },
      { name: 'media_id', type: 'text' },
      { name: 'timestamp', type: 'date' },
    ]
  },
  {
    name: 'keepalive_log',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'timestamp', type: 'date' },
    ]
  },
  {
    name: 'layout_templates',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'config', type: 'json' },
    ]
  },
  {
    name: 'advertiser_devices',
    type: 'base',
    schema: [
      { name: 'advertiser_id', type: 'text' },
      { name: 'device_id', type: 'text' },
    ]
  },
  {
    name: 'advertisers',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
    ]
  },
  {
    name: 'device_categories',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'category_id', type: 'text' },
    ]
  },
  {
    name: 'categories',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
      { name: 'slug', type: 'text' },
    ]
  },
  {
    name: 'device_overrides',
    type: 'base',
    schema: [
      { name: 'device_id', type: 'text' },
      { name: 'media_id', type: 'text' },
    ]
  },
  {
    name: 'organization_admins',
    type: 'base',
    schema: [
      { name: 'organization_id', type: 'text' },
      { name: 'user_id', type: 'text' },
    ]
  },
  {
    name: 'push_subscriptions',
    type: 'base',
    schema: [
      { name: 'user_id', type: 'text' },
      { name: 'endpoint', type: 'text' },
      { name: 'keys', type: 'json' },
    ]
  },
  {
    name: 'revenues',
    type: 'base',
    schema: [
      { name: 'campaign_id', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'date', type: 'date' },
    ]
  },
  {
    name: 'units',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'organization_id', type: 'text' },
    ]
  },
  {
    name: 'partners',
    type: 'base',
    schema: [
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['active', 'inactive'] } },
    ]
  },
];

async function main() {
  const pb = await authPB();
  console.log('✅ Admin auth OK');

  // Get existing
  const existing = await pb.collections.getList(1, 100);
  const existingNames = new Set(existing.items.map(c => c.name));
  console.log(`Existing: ${existing.items.length}`);

  let created = 0;
  let skipped = 0;

  for (const col of collections) {
    if (existingNames.has(col.name)) {
      skipped++;
      continue;
    }

    try {
      await pb.collections.create({
        name: col.name,
        type: col.type,
        schema: col.schema,
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
      });
      console.log(`✅ ${col.name} created`);
      created++;
    } catch (e) {
      console.error(`❌ ${col.name}:`, e.message);
    }
  }

  console.log(`\n📋 Result: ${created} created, ${skipped} skipped`);
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
