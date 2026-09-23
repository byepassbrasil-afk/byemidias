const https = require('https');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(options.headers || {}) };
    Object.keys(headers).forEach(k => { if (headers[k] === undefined) delete headers[k]; });
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  const loginBody = JSON.stringify({
    email: 'deploytest1924551704@gmail.com',
    password: 'SenhaForte123456',
  });
  const login = await request('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) },
    body: loginBody,
  });
  const cookie = login.headers['set-cookie']?.[0]?.split(';')[0];
  console.log('Login:', login.status);

  // Test scan-or-create
  const deviceUuid = `test-device-uuid-${Date.now()}`;
  const scanBody = JSON.stringify({
    device_uuid: deviceUuid,
    model: 'Test Model XYZ',
  });
  const scan = await request('https://byemidias.vercel.app/api/admin/devices/scan-or-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(scanBody), 'Cookie': cookie },
    body: scanBody,
  });
  console.log('Scan-or-create:', scan.status);
  console.log('Body:', scan.body);

  // Tenta de novo (deve detectar existente)
  const scan2 = await request('https://byemidias.vercel.app/api/admin/devices/scan-or-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(scanBody), 'Cookie': cookie },
    body: scanBody,
  });
  console.log('\nScan-or-create (2nd time):', scan2.status);
  console.log('Body:', scan2.body);

  // Test keepalive
  const ka = await request('https://byemidias.vercel.app/api/keepalive');
  console.log('\nKeepalive:', ka.status);
  console.log('Body:', ka.body);
})().catch(console.error);
