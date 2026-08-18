const { Client } = require('pg');

const c = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  // Get partner ID
  const partner = await c.query("SELECT id, username FROM partner_access WHERE username = 'damares'");
  const partnerId = partner.rows[0].id;
  console.log('Partner:', partner.rows[0].username, partnerId);

  // Get playlist ID (use the approved one)
  const playlist = await c.query("SELECT id, name, version FROM playlists WHERE name = 'mercado bla bla bla' AND approval_status = 'approved' ORDER BY version DESC LIMIT 1");
  const playlistId = playlist.rows[0].id;
  console.log('Playlist:', playlist.rows[0].name, 'v' + playlist.rows[0].version, playlistId);

  // Create a slot for this partner
  const slot = await c.query(
    'INSERT INTO playlist_slots (playlist_id, partner_access_id, slot_order, duration_seconds) VALUES ($1, $2, $3, $4) RETURNING *',
    [playlistId, partnerId, 0, 30]
  );
  console.log('Slot created:', slot.rows[0]);

  // Verify slot exists
  const slots = await c.query(
    'SELECT ps.*, pa.username FROM playlist_slots ps JOIN partner_access pa ON ps.partner_access_id = pa.id WHERE ps.playlist_id = $1',
    [playlistId]
  );
  console.log('\nSlots in playlist:');
  slots.rows.forEach(s => {
    console.log(`  Slot ${s.slot_order}: ${s.username} (${s.duration_seconds}s)`);
  });

  await c.end();
  console.log('\n=== SLOT CREATION TEST COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
