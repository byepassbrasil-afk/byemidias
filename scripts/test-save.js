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

  // Test /api/admin/media/save
  const saveBody = JSON.stringify({
    file_name: 'test-image.png',
    mime_type: 'image/png',
    file_url: 'https://pub-1fc1e39765fd4278b118feb04d4f44fe.r2.dev/media/test.png',
    file_size: 12345,
    organization_id: '33058ec18d6fc1e',
    ttl_days: 7,
    display_name: 'Test Image',
    default_orientation: 'auto',
  });
  const save = await request('https://byemidias.vercel.app/api/admin/media/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(saveBody), 'Cookie': cookie },
    body: saveBody,
  });
  console.log('Save media:', save.status);
  console.log('Body:', save.body);
})().catch(console.error);
