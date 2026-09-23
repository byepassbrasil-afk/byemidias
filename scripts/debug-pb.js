const PocketBase = require('pocketbase/cjs');

async function main() {
  const url = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

  // Try to list superusers (the new way for v0.21+)
  try {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);

    // Try the new auth endpoint for superusers
    try {
      await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
      console.log('✅ _superusers auth works!');
    } catch (e) {
      console.log('❌ _superusers auth failed:', e.message);
    }

    // Try with body containing identity
    try {
      const res = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'gwmorata@gmail.com', password: '@Gaedaam08' }),
      });
      const data = await res.json();
      console.log('_superusers fetch:', res.status, JSON.stringify(data).slice(0, 200));
    } catch (e) {
      console.log('_superusers fetch error:', e.message);
    }

    // Try /api/admins/auth-with-password
    try {
      const res = await fetch(`${url}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'gwmorata@gmail.com', password: '@Gaedaam08' }),
      });
      const data = await res.json();
      console.log('admins fetch:', res.status, JSON.stringify(data).slice(0, 200));
    } catch (e) {
      console.log('admins fetch error:', e.message);
    }

    // List collections without auth
    try {
      const res = await fetch(`${url}/api/collections`);
      console.log('collections list:', res.status);
    } catch (e) {
      console.log('collections list error:', e.message);
    }

    // Try superuser record endpoint
    try {
      const res = await fetch(`${url}/api/admins`);
      console.log('admins list:', res.status);
    } catch (e) {
      console.log('admins list error:', e.message);
    }

  } catch (e) {
    console.error('Error:', e);
  }
}

main();
