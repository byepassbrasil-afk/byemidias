const http = require('http');
const fs = require('fs');
const path = require('path');

const cookieJar = {};

function login() {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify({ username: 'damares', password: '123456' });
    const r = http.request({
      hostname: 'localhost', port: 3000,
      path: '/api/partner/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': d.length }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const cookie = (res.headers['set-cookie'] || [])[0]?.split(';')[0] || '';
        console.log('Login:', res.statusCode, b);
        resolve(cookie);
      });
    });
    r.write(d);
    r.end();
  });
}

function uploadMedia(cookie) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary123';
    const fileContent = 'fake test content for upload';
    let body = '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="file"; filename="test-upload.txt"\r\n';
    body += 'Content-Type: text/plain\r\n\r\n';
    body += fileContent + '\r\n';
    body += '--' + boundary + '--\r\n';

    const r = http.request({
      hostname: 'localhost', port: 3000,
      path: '/api/partner/media', method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        console.log('Upload:', res.statusCode, b);
        resolve(b);
      });
    });
    r.write(body);
    r.end();
  });
}

function listMedia(cookie) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: 'localhost', port: 3000,
      path: '/api/partner/media', method: 'GET',
      headers: { Cookie: cookie }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        console.log('Media list:', res.statusCode, b);
        resolve(b);
      });
    });
    r.end();
  });
}

(async () => {
  const cookie = await login();
  await uploadMedia(cookie);
  await listMedia(cookie);
  console.log('E2E partner flow complete!');
})().catch(e => console.error('FATAL:', e.message));
