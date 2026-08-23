const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = 'prj_eUxwQ2EiRpv9srmYPCMaA7XlRKBE';
const TEAM_ID = 'team_uPhdzVBLnxFgz6qJi435AK1g';
const ROOT = path.resolve(__dirname, '..', 'apps', 'web');

const IGNORE_DIRS = ['node_modules', '.next', '.turbo', '.git'];
const IGNORE_FILES = ['.env.local', 'package-lock.json'];

function sha1(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function getFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.includes(entry.name)) continue;
      results.push(...getFiles(path.join(dir, entry.name), rel));
    } else {
      if (IGNORE_FILES.includes(entry.name)) continue;
      results.push(rel);
    }
  }
  return results;
}

function uploadFile(digest, content) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.vercel.com',
      path: '/v2/files',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': digest,
        'Content-Length': content.length,
      },
    };
    const req = https.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.vercel.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Collecting files from', ROOT);
  const files = getFiles(ROOT);
  console.log(`Found ${files.length} files`);

  const fileEntries = [];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const content = fs.readFileSync(abs);
    const hash = sha1(content);
    fileEntries.push({ rel, abs, content, hash });
  }

  // Upload all files in parallel batches of 10
  console.log('Uploading files...');
  let uploaded = 0;
  let failed = 0;
  const BATCH = 10;
  for (let i = 0; i < fileEntries.length; i += BATCH) {
    const batch = fileEntries.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(f => uploadFile(f.hash, f.content)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 200 || r.status === 201) {
        uploaded++;
      } else {
        failed++;
        console.log(`  FAIL ${batch[j].rel}: ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
      }
    }
    process.stdout.write(`  ${uploaded}/${fileEntries.length} uploaded\r`);
  }
  console.log(`\n  Uploaded: ${uploaded}, Failed: ${failed}`);

  // Create deployment
  console.log('Creating deployment...');
  const deploymentBody = {
    name: 'byemidias',
    project: PROJECT_ID,
    files: fileEntries.map(f => ({
      file: f.rel.replace(/\\/g, '/'),
      sha: f.hash,
      size: f.content.length,
    })),
    target: 'production',
  };

  const res = await apiRequest('POST', `/v13/deployments?teamId=${TEAM_ID}`, deploymentBody);
  if (res.status === 200 || res.status === 201) {
    console.log('Deployment created!');
    console.log('URL:', res.data.url);
    console.log('ID:', res.data.id);
    console.log('Ready:', res.data.readyState);
  } else {
    console.log('ERROR:', res.status, JSON.stringify(res.data).slice(0, 1000));
  }
}

main().catch(console.error);
