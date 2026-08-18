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
  console.log('=== TEST 1: Partner login ===');
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'damares', password: '123456' });
  console.log('Login:', loginRes.status, loginRes.data.success ? 'OK' : 'FAIL');
  const partnerCookie = loginRes.cookie;

  console.log('\n=== TEST 2: Partner media list (should only show own uploads) ===');
  const mediaRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/media', method: 'GET',
    headers: { Cookie: partnerCookie }
  });
  console.log('Media count:', mediaRes.data.media?.length || 0);
  console.log('Media:', JSON.stringify(mediaRes.data.media?.map(m => m.name) || []));

  console.log('\n=== TEST 3: Admin login ===');
  // Use service_role to check pending playlists
  const pendingRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/admin/playlists/pending', method: 'GET',
    headers: { 
      Cookie: partnerCookie,  // Will fail auth but tests the endpoint
    }
  });
  console.log('Pending playlists (expected 401):', pendingRes.status);

  console.log('\n=== TEST 4: Check current playlists ===');
  const plRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/devices', method: 'GET',
    headers: { Cookie: partnerCookie }
  });
  console.log('Partner devices:', JSON.stringify(plRes.data.devices?.map(d => ({ name: d.device_name, playlist: d.playlist_name })) || []));

  console.log('\n=== ALL TESTS COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
