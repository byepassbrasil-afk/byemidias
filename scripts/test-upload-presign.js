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

  // Test upload-proxy (deve retornar presigned URL)
  const presign = await request('https://byemidias.vercel.app/api/admin/media/upload-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Filename': 'test-video.mp4',
      'X-Organization-Id': '33058ec18d6fc1e',
      'Cookie': cookie,
    },
    body: JSON.stringify({}),
  });
  console.log('Presign status:', presign.status);
  const data = JSON.parse(presign.body);
  console.log('Has upload_url:', !!data.upload_url);
  console.log('Has public_url:', !!data.public_url);
  console.log('Public URL:', data.public_url);
})().catch(console.error);
