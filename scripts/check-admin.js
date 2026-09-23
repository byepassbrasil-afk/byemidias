const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch ? dbMatch[1].trim() : null;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const email = process.argv[2];

  // List all profiles
  const all = await client.query(
    `SELECT id, email, full_name, role, status, organization_id,
            LEFT(password_hash, 25) as hash_prefix, created_at
     FROM profiles
     ORDER BY created_at`
  );
  console.log(`📊 Total de perfis: ${all.rows.length}\n`);
  for (const p of all.rows) {
    console.log(`  - ${p.email} | ${p.full_name} | role=${p.role} | status=${p.status} | hash=${p.hash_prefix}...`);
  }

  if (email) {
    console.log(`\n🔍 Verificando especificamente: ${email}`);
    const r = await client.query(
      `SELECT id, email, full_name, role, status, password_hash, organization_id FROM profiles WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (r.rows.length === 0) {
      console.log(`  ❌ Email não encontrado (tentado: "${email.toLowerCase().trim()}")`);
    } else {
      const p = r.rows[0];
      console.log(`  ✅ Encontrado:`);
      console.log(`     Email: ${p.email}`);
      console.log(`     Nome: ${p.full_name}`);
      console.log(`     Role: ${p.role}`);
      console.log(`     Status: ${p.status}`);
      console.log(`     Hash: ${p.password_hash.substring(0, 30)}...`);
      if (p.status !== 'active') console.log(`     ⚠️  CONTA NÃO ESTÁ ACTIVE!`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
