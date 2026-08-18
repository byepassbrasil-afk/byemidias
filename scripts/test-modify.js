const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), cookie: (res.headers['set-cookie'] || [])[0]?.split(';')[0] || '' });
        } catch {
          resolve({ status: res.statusCode, data, cookie: (res.headers['set-cookie'] || [])[0]?.split(';')[0] || '' });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('=== Partner login ===');
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'damares', password: '123456' });
  const cookie = loginRes.cookie;
  console.log('Login:', loginRes.status === 200 ? 'OK' : 'FAIL');

  // Get the playlist ID for "mercado bla bla bla"
  const devicesRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/devices', method: 'GET',
    headers: { Cookie: cookie }
  });
  const playlistId = devicesRes.data.devices?.[0]?.playlist_id;
  console.log('Playlist ID:', playlistId);

  // Get partner's media
  const mediaRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/media', method: 'GET',
    headers: { Cookie: cookie }
  });
  const mediaId = mediaRes.data.media?.[0]?.id;
  console.log('Media ID:', mediaId);

  if (!playlistId || !mediaId) {
    console.log('Missing playlist or media, cannot test');
    return;
  }

  console.log('\n=== Test: Add media to playlist (should create pending version) ===');
  const addRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/playlists/modify', method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, { playlist_id: playlistId, action: 'add', media_id: mediaId });
  console.log('Add result:', addRes.status, JSON.stringify(addRes.data));

  console.log('\n=== Check: Original playlist should still be approved ===');
  const { Client } = require('pg');
  const c = new Client({
    connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  
  const playlists = await c.query(
    'SELECT id, name, version, approval_status, parent_id FROM playlists ORDER BY created_at DESC'
  );
  console.log('Playlists after modification:');
  playlists.rows.forEach(p => {
    console.log(`  ${p.name} v${p.version} [${p.approval_status}] parent=${p.parent_id || 'none'}`);
  });

  // Check items in original and new version
  for (const pl of playlists.rows) {
    const items = await c.query(
      'SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = $1',
      [pl.id]
    );
    console.log(`  ${pl.name} v${pl.version}: ${items.rows[0].count} items`);
  }

  await c.end();
  console.log('\n=== TEST COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
