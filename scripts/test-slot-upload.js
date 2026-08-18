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

  // Get partner's media
  const mediaRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/media', method: 'GET',
    headers: { Cookie: cookie }
  });
  const mediaId = mediaRes.data.media?.[0]?.id;
  console.log('Media ID:', mediaId);

  // Get slot ID
  const slotsRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/slots', method: 'GET',
    headers: { Cookie: cookie }
  });
  const slotId = slotsRes.data.slots?.[0]?.id;
  const playlistId = slotsRes.data.slots?.[0]?.playlist_id;
  console.log('Slot ID:', slotId);
  console.log('Playlist ID:', playlistId);

  if (!mediaId || !slotId || !playlistId) {
    console.log('Missing data, cannot test');
    return;
  }

  console.log('\n=== Add media to slot via versioning ===');
  const addRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/playlists/modify', method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, { playlist_id: playlistId, action: 'add', media_id: mediaId, slot_id: slotId });
  console.log('Add result:', addRes.status, JSON.stringify(addRes.data));

  console.log('\n=== Check slot items ===');
  const itemsRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/partner/slots/${slotId}/items`, method: 'GET',
    headers: { Cookie: cookie }
  });
  console.log('Items:', JSON.stringify(itemsRes.data, null, 2));

  console.log('\n=== TEST COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
