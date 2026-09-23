const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log('Tabelas no schema public:');
  for (const x of r.rows) console.log('  ' + x.table_name);
  await c.end();
})().catch(e => console.error('Error:', e.message));
