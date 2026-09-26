const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("SELECT email, password_hash FROM profiles WHERE email='gwmorata@gmail.com'");
  const row = r.rows[0];
  console.log('Email:', row.email);
  const ok = await bcrypt.compare('@Gaedaam08', row.password_hash);
  console.log('bcrypt match:', ok);
  console.log('Hash:', row.password_hash.substring(0, 30));
  await c.end();
})().catch(e => console.error(e.message));
