const https = require('https');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      method: options.method || 'GET',
      headers: options.headers || {},
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

  // Test campaign_playlists sem order
  const cp1 = await request('https://byemidias.vercel.app/api/admin/crud/campaign_playlists', {
    headers: { Cookie: cookie },
  });
  console.log('CP sem order:', cp1.status, cp1.body.slice(0, 200));

  // Test com order=position
  const cp2 = await request('https://byemidias.vercel.app/api/admin/crud/campaign_playlists?order=position', {
    headers: { Cookie: cookie },
  });
  console.log('CP order=position:', cp2.status, cp2.body.slice(0, 200));

  // Test com order=id
  const cp3 = await request('https://byemidias.vercel.app/api/admin/crud/campaign_playlists?order=id', {
    headers: { Cookie: cookie },
  });
  console.log('CP order=id:', cp3.status, cp3.body.slice(0, 200));

  // Test com order=position&asc=true
  const cp4 = await request('https://byemidias.vercel.app/api/admin/crud/campaign_playlists?order=position&asc=true', {
    headers: { Cookie: cookie },
  });
  console.log('CP order=position&asc=true:', cp4.status, cp4.body.slice(0, 300));

  // Test activation codes após fix
  const act = await request('https://byemidias.vercel.app/api/admin/activation-codes', {
    headers: { Cookie: cookie },
  });
  console.log('\nActivation codes:', act.status, act.body.slice(0, 300));
})().catch(console.error);
