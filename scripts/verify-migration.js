const { Client } = require('pg');
const fs = require('fs');
const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema='public'
       AND ((table_name='media' AND column_name LIKE 'excluded_%')
            OR (table_name='organizations' AND column_name='category_id'))
     ORDER BY table_name, column_name`
  );
  for (const x of r.rows) console.log(`${x.table_name}.${x.column_name}: ${x.data_type} nullable=${x.is_nullable}`);
  await c.end();
})();
