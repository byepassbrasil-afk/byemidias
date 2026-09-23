const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);

  // Test various endpoints
  console.log('Testing PocketBase API...');

  try {
    const health = await fetch(`${PB_URL}/api/health`);
    console.log('GET /api/health:', health.status, await health.text());
  } catch (e) {
    console.log('GET /api/health failed:', e.message);
  }

  try {
    const root = await fetch(PB_URL);
    console.log('GET /:', root.status, await root.text().then(t => t.slice(0, 100)));
  } catch (e) {
    console.log('GET / failed:', e.message);
  }

  try {
    // Try admin API
    const admins = await fetch(`${PB_URL}/api/admins`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('GET /api/admins:', admins.status);
  } catch (e) {
    console.log('GET /api/admins failed:', e.message);
  }

  // Test with PocketBase SDK
  try {
    const pb2 = new PocketBase(PB_URL);
    await pb2.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
    console.log('✅ SDK admin auth works!');
  } catch (e) {
    console.log('❌ SDK admin auth failed:', e.message);
  }
}

main();
