const { Client } = require('pg');
const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

(async () => {
  const c = new Client({
    connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Get the pending playlist
  const pending = await c.query(
    "SELECT id, name, version, parent_id FROM playlists WHERE approval_status = 'pending' LIMIT 1"
  );
  
  if (pending.rows.length === 0) {
    console.log('No pending playlists found');
    await c.end();
    return;
  }

  const pl = pending.rows[0];
  console.log('Pending playlist:', pl.name, 'v' + pl.version);
  console.log('Parent ID:', pl.parent_id);

  // Approve it directly via SQL (simulating admin)
  await c.query(
    "UPDATE playlists SET approval_status = 'approved', approved_by = 'admin@test.com', approved_at = NOW() WHERE id = $1",
    [pl.id]
  );

  // Archive old version
  if (pl.parent_id) {
    await c.query(
      "UPDATE playlists SET status = 'inactive' WHERE id = $1",
      [pl.parent_id]
    );

    // Update partner_devices to point to new version
    await c.query(
      "UPDATE partner_devices SET playlist_id = $1 WHERE playlist_id = $2",
      [pl.id, pl.parent_id]
    );
  }

  console.log('\n=== After approval ===');
  const playlists = await c.query(
    'SELECT id, name, version, approval_status, status FROM playlists ORDER BY created_at DESC'
  );
  playlists.rows.forEach(p => {
    console.log(`  ${p.name} v${p.version} approval=${p.approval_status} status=${p.status}`);
  });

  const devices = await c.query(
    'SELECT d.name, p.name as playlist_name FROM partner_devices pd JOIN devices d ON pd.device_id = d.id JOIN playlists p ON pd.playlist_id = p.id'
  );
  console.log('\nPartner devices after approval:');
  devices.rows.forEach(d => {
    console.log(`  ${d.name} → ${d.playlist_name}`);
  });

  await c.end();
  console.log('\n=== APPROVAL TEST COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
