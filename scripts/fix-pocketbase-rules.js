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

// Collections que devem ser acessíveis por usuários autenticados
const USER_ACCESSIBLE_COLLECTIONS = [
  'organizations',
  'profiles',
  'devices',
  'media',
  'campaigns',
  'playlists',
  'playlist_items',
  'playlist_slots',
  'campaign_playlists',
  'campaign_targets',
  'campaign_time_slots',
  'campaign_calendar',
  'content_schedules',
  'device_groups',
  'device_group_members',
  'device_logs',
  'device_uptime_sessions',
  'activation_codes',
  'partner_access',
  'partner_devices',
  'partner_payments',
  'partner_invoices',
  'partner_media_uploads',
  'playback_logs',
  'keepalive_log',
  'layout_templates',
  'advertiser_devices',
  'advertisers',
  'device_categories',
  'categories',
  'device_overrides',
  'organization_admins',
  'push_subscriptions',
  'revenues',
  'units',
  'partners',
];

async function main() {
  const pb = await authPB();
  console.log('✅ Admin auth OK');

  // Estratégia: usar regras de superuser (null = superuser only) e regras de filtro
  // Para acesso público: deixar null (qualquer um pode ler/escrever)
  // Para acesso autenticado: usar @request.auth.id != ""
  // Para acesso por owner: usar @request.auth.id = user_id

  let updated = 0;
  let failed = 0;

  for (const name of USER_ACCESSIBLE_COLLECTIONS) {
    try {
      const col = await pb.collections.getOne(name);

      // Regras que permitem acesso a usuários autenticados
      const rules = {
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
      };

      await pb.collections.update(col.id, rules);
      console.log(`✅ ${name} rules updated`);
      updated++;
    } catch (e) {
      console.error(`❌ ${name}:`, e.message);
      failed++;
    }
  }

  console.log(`\n📋 Result: ${updated} updated, ${failed} failed`);
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
