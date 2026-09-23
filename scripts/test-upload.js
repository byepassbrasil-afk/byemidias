const https = require('https');
const fs = require('fs');

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
      let body = Buffer.alloc(0);
      res.on('data', c => body = Buffer.concat([body, c]));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (options.body) {
      if (Buffer.isBuffer(options.body)) req.write(options.body);
      else req.write(options.body);
    }
    req.end();
  });
}

(async () => {
  // Login
  const loginBody = JSON.stringify({
    email: 'deploytest1924551704@gmail.com',
    password: 'SenhaForte123456',
  });

  const login = await request('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) },
    body: loginBody,
  });
  console.log('Login:', login.status);
  const cookie = login.headers['set-cookie']?.[0]?.split(';')[0];

  // Test upload-proxy com arquivo pequeno
  const fakeFile = Buffer.from('Hello World!');
  const upload = await request('https://byemidias.vercel.app/api/admin/media/upload-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': fakeFile.length,
      'X-Filename': 'test-upload.png',
      'X-Organization-Id': '33058ec18d6fc1e',
      'Cookie': cookie,
    },
    body: fakeFile,
  });
  console.log('Upload-proxy:', upload.status);
  console.log('Body:', upload.body.toString());
})().catch(console.error);
