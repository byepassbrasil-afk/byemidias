const { Client } = require('pg');

const c = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  console.log('=== CHECK PLAYLIST VERSIONS ===');
  const playlists = await c.query(
    'SELECT id, name, version, approval_status, parent_id, requested_by FROM playlists ORDER BY created_at DESC'
  );
  console.log('All playlists:');
  playlists.rows.forEach(p => {
    console.log(`  ${p.name} v${p.version} [${p.status}] approval=${p.approval_status} parent=${p.parent_id || 'none'} requested_by=${p.requested_by || 'none'}`);
  });

  console.log('\n=== CHECK PLAYLIST ITEMS ===');
  for (const pl of playlists.rows) {
    const items = await c.query(
      'SELECT pi.position, m.name, m.type FROM playlist_items pi JOIN media m ON pi.media_id = m.id WHERE pi.playlist_id = $1 ORDER BY pi.position',
      [pl.id]
    );
    console.log(`  ${pl.name} v${pl.version}: ${items.rows.length} items`);
    items.rows.forEach(i => console.log(`    ${i.position + 1}. ${i.name} (${i.type})`));
  }

  console.log('\n=== CHECK PARTNER DEVICES ===');
  const devices = await c.query(
    'SELECT pd.device_id, d.name as device_name, pd.playlist_id, p.name as playlist_name FROM partner_devices pd JOIN devices d ON pd.device_id = d.id JOIN playlists p ON pd.playlist_id = p.id'
  );
  devices.rows.forEach(d => {
    console.log(`  ${d.device_name} → ${d.playlist_name}`);
  });

  await c.end();
})().catch(e => console.error('FATAL:', e.message));
