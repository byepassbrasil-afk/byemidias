const { Client } = require('pg');
const HOST = 'byemidias-supabase-2f9293-2-25-238-133.sslip.io';
const PASSWORD = 'b85idmclmfmicq1gyighd8a4hqhy078r';

const client = new Client({
  host: HOST,
  port: 5432,
  user: 'postgres',
  password: PASSWORD,
  database: 'postgres',
  ssl: false,
});

async function main() {
  await client.connect();

  // Check profiles
  const profiles = await client.query('SELECT id, email, full_name, role FROM profiles LIMIT 10');
  console.log('📋 Profiles:', profiles.rows.length);
  profiles.rows.forEach(r => console.log('  -', r.email, '|', r.full_name, '|', r.role));

  // Check test_playlists
  const playlists = await client.query('SELECT id, name FROM test_playlists LIMIT 10');
  console.log('\n📋 test_playlists:', playlists.rows.length);
  playlists.rows.forEach(r => console.log('  -', r.name, '|', r.id));

  // Check organizations
  const orgs = await client.query('SELECT id, name, slug FROM organizations LIMIT 10');
  console.log('\n📋 Organizations:', orgs.rows.length);
  orgs.rows.forEach(r => console.log('  -', r.name, '|', r.slug, '|', r.id));

  await client.end();
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
