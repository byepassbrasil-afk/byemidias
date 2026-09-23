const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const NEW_PASSWORD = '@Gaedaam08';
const EMAILS = ['gwmorata@gmail.com', 'byemidias@gmail.com'];

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('🔐 Gerando hash bcrypt para:', NEW_PASSWORD);
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  console.log('   hash:', hash.substring(0, 30) + '...');

  for (const email of EMAILS) {
    const r = await c.query(
      `UPDATE profiles SET password_hash = $1, updated_at = NOW()
       WHERE email = $2
       RETURNING id, email, full_name, role, status`,
      [hash, email.toLowerCase().trim()]
    );
    if (r.rows.length === 0) {
      console.log(`  ❌ ${email} — não encontrado`);
    } else {
      const u = r.rows[0];
      console.log(`  ✅ ${u.email} (${u.full_name}) role=${u.role} status=${u.status}`);
    }
  }

  // Verifica que a senha nova funciona
  console.log('\n🧪 Verificando que bcrypt.compare aceita a senha nova...');
  const v = await c.query(`SELECT email, password_hash FROM profiles WHERE email = ANY($1)`, [EMAILS.map(e => e.toLowerCase().trim())]);
  for (const row of v.rows) {
    const ok = await bcrypt.compare(NEW_PASSWORD, row.password_hash);
    console.log(`  ${row.email}: ${ok ? '✅ OK' : '❌ FALHOU'}`);
  }

  await c.end();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
