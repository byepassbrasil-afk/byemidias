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

  console.log('--- Login ---');
  const login = await request('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) },
    body: loginBody,
  });
  console.log('Login status:', login.status);
  const cookieHeader = login.headers['set-cookie'];
  const cookie = cookieHeader && cookieHeader[0] ? cookieHeader[0].split(';')[0] : '';
  console.log('Cookie:', cookie.slice(0, 60));

  if (!cookie) {
    console.log('NO COOKIE - abort');
    return;
  }

  const endpoints = [
    '/api/admin/crud/devices',
    '/api/admin/crud/media',
    '/api/admin/crud/organizations',
    '/api/admin/crud/campaigns',
    '/api/admin/crud/campaign_playlists',
    '/api/admin/crud/playlists',
    '/api/admin/activation-codes',
    '/api/admin/partners',
  ];

  for (const ep of endpoints) {
    const r = await request('https://byemidias.vercel.app' + ep, {
      headers: { Cookie: cookie },
    });
    let body;
    try { body = JSON.parse(r.body); } catch { body = r.body.slice(0, 100); }
    const count = body.data?.length ?? body.codes?.length ?? body.partners?.length ?? '?';
    console.log(`${ep} -> ${r.status} | count: ${count} | error: ${body.error?.slice(0, 80) || '-'}`);
  }
})().catch(console.error);
