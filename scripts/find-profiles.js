const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r = await c.query(
    `SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_name = 'profiles' OR table_name = 'organizations'
     ORDER BY table_schema, table_name`
  );
  console.log('Tabelas profiles/organizations:');
  for (const row of r.rows) {
    console.log('  schema=' + row.table_schema + ' tabela=' + row.table_name);
  }

  const r2 = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles'
     ORDER BY ordinal_position`
  );
  console.log('\nColunas da public.profiles:');
  for (const row of r2.rows) console.log('  - ' + row.column_name + ' (' + row.data_type + ')');

  const r3 = await c.query(`SELECT email, full_name, role, status, created_at FROM profiles ORDER BY created_at`);
  console.log('\nUsuários cadastrados (' + r3.rows.length + '):');
  for (const row of r3.rows) {
    console.log('  - ' + row.email + ' (' + row.full_name + ') role=' + row.role + ' status=' + row.status);
  }

  await c.end();
})().catch(e => console.error('Error:', e.message));
