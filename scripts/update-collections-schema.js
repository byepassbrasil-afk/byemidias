const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

const collections = [
  { name: 'organizations', schema: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'status', type: 'select', options: { values: ['active', 'pending_approval', 'suspended'] } },
    { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'pro', 'enterprise'] } },
    { name: 'max_devices', type: 'number' },
    { name: 'owner_id', type: 'text' },
  ]},
  { name: 'profiles', schema: [
    { name: 'user_id', type: 'text', required: true },
    { name: 'email', type: 'text', required: true },
    { name: 'full_name', type: 'text' },
    { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer', 'super_admin'] } },
    { name: 'status', type: 'select', options: { values: ['active', 'pending_invite', 'suspended'] } },
    { name: 'organization_id', type: 'text' },
  ]},
  { name: 'devices', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['online', 'offline', 'pending'] } },
    { name: 'last_heartbeat', type: 'date' },
    { name: 'location_lat', type: 'number' },
    { name: 'location_lng', type: 'number' },
    { name: 'location_name', type: 'text' },
    { name: 'model', type: 'text' },
    { name: 'campaign_id', type: 'text' },
  ]},
  { name: 'media', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'url', type: 'text' },
    { name: 'type', type: 'select', options: { values: ['image', 'video', 'html'] } },
    { name: 'status', type: 'select', options: { values: ['active', 'blocked'] } },
    { name: 'duration', type: 'number' },
  ]},
  { name: 'campaigns', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['draft', 'active', 'paused', 'finished'] } },
    { name: 'start_date', type: 'date' },
    { name: 'end_date', type: 'date' },
  ]},
  { name: 'playlists', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['draft', 'active', 'pending_approval'] } },
    { name: 'approved_at', type: 'date' },
  ]},
  { name: 'playlist_items', schema: [
    { name: 'playlist_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'order_index', type: 'number' },
  ]},
  { name: 'playlist_slots', schema: [
    { name: 'playlist_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'slot_index', type: 'number' },
    { name: 'duration', type: 'number' },
  ]},
  { name: 'campaign_playlists', schema: [
    { name: 'campaign_id', type: 'text' },
    { name: 'playlist_id', type: 'text' },
  ]},
  { name: 'campaign_targets', schema: [
    { name: 'campaign_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ]},
  { name: 'campaign_time_slots', schema: [
    { name: 'campaign_id', type: 'text' },
    { name: 'playlist_id', type: 'text' },
    { name: 'day_of_week', type: 'number' },
    { name: 'start_time', type: 'text' },
    { name: 'end_time', type: 'text' },
  ]},
  { name: 'campaign_calendar', schema: [
    { name: 'campaign_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'date', type: 'date' },
  ]},
  { name: 'content_schedules', schema: [
    { name: 'playlist_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'start_time', type: 'text' },
    { name: 'end_time', type: 'text' },
  ]},
  { name: 'device_groups', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ]},
  { name: 'device_group_members', schema: [
    { name: 'device_group_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ]},
  { name: 'device_logs', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'campaign_id', type: 'text' },
    { name: 'event', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ]},
  { name: 'device_uptime_sessions', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'started_at', type: 'date' },
    { name: 'ended_at', type: 'date' },
  ]},
  { name: 'activation_codes', schema: [
    { name: 'code', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'linked_device_id', type: 'text' },
    { name: 'used', type: 'bool' },
    { name: 'expires_at', type: 'date' },
  ]},
  { name: 'partner_access', schema: [
    { name: 'partner_id', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'role', type: 'select', options: { values: ['admin', 'manager', 'viewer'] } },
  ]},
  { name: 'partner_devices', schema: [
    { name: 'partner_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ]},
  { name: 'partner_payments', schema: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'select', options: { values: ['pending', 'paid', 'failed'] } },
    { name: 'due_date', type: 'date' },
  ]},
  { name: 'partner_invoices', schema: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'select', options: { values: ['pending', 'paid'] } },
    { name: 'due_date', type: 'date' },
  ]},
  { name: 'partner_media_uploads', schema: [
    { name: 'partner_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['pending', 'approved', 'rejected'] } },
  ]},
  { name: 'playback_logs', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'campaign_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ]},
  { name: 'keepalive_log', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'timestamp', type: 'date' },
  ]},
  { name: 'layout_templates', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'config', type: 'json' },
  ]},
  { name: 'advertiser_devices', schema: [
    { name: 'advertiser_id', type: 'text' },
    { name: 'device_id', type: 'text' },
  ]},
  { name: 'advertisers', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ]},
  { name: 'device_categories', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'category_id', type: 'text' },
  ]},
  { name: 'categories', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'slug', type: 'text' },
  ]},
  { name: 'device_overrides', schema: [
    { name: 'device_id', type: 'text' },
    { name: 'media_id', type: 'text' },
  ]},
  { name: 'organization_admins', schema: [
    { name: 'organization_id', type: 'text' },
    { name: 'user_id', type: 'text' },
  ]},
  { name: 'push_subscriptions', schema: [
    { name: 'user_id', type: 'text' },
    { name: 'endpoint', type: 'text' },
    { name: 'keys', type: 'json' },
  ]},
  { name: 'revenues', schema: [
    { name: 'campaign_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'date', type: 'date' },
  ]},
  { name: 'units', schema: [
    { name: 'name', type: 'text' },
    { name: 'organization_id', type: 'text' },
  ]},
  { name: 'partners', schema: [
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['active', 'inactive'] } },
  ]},
];

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);

  try {
    await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  } catch (e) {
    if (e.status === 404) {
      await pb.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
    } else {
      throw e;
    }
  }
  console.log('✅ Admin auth OK');

  let updated = 0;
  let failed = 0;

  for (const col of collections) {
    try {
      const existing = await pb.collections.getOne(col.name);
      await pb.collections.update(existing.id, {
        schema: col.schema,
      });
      updated++;
      console.log(`✅ ${col.name} schema updated`);
    } catch (e) {
      failed++;
      console.error(`❌ ${col.name}: ${e.message}`);
    }
  }

  console.log(`\n📋 Result: ${updated} updated, ${failed} failed`);
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
