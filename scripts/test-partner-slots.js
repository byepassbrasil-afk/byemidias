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

  console.log('\n=== Get partner slots ===');
  const slotsRes = await makeRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/partner/slots', method: 'GET',
    headers: { Cookie: cookie }
  });
  console.log('Slots:', JSON.stringify(slotsRes.data, null, 2));

  if (slotsRes.data.slots?.length > 0) {
    const slotId = slotsRes.data.slots[0].id;
    console.log('\n=== Get slot items ===');
    const itemsRes = await makeRequest({
      hostname: 'localhost', port: 3000,
      path: `/api/partner/slots/${slotId}/items`, method: 'GET',
      headers: { Cookie: cookie }
    });
    console.log('Items:', JSON.stringify(itemsRes.data, null, 2));
  }

  console.log('\n=== TEST COMPLETE ===');
})().catch(e => console.error('FATAL:', e.message));
