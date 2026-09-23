const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const show = async (table) => {
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n=== ${table} ===`);
    for (const x of r.rows) console.log(`  ${x.column_name} (${x.data_type})`);
  };
  await show('categories');
  await show('device_categories');
  await show('category_history');
  await show('category_history_sync_state');

  const r = await c.query(`SELECT * FROM categories ORDER BY name`);
  console.log(`\n=== Categorias (${r.rows.length}) ===`);
  for (const x of r.rows) console.log('  ' + JSON.stringify(x));

  const r2 = await c.query(`SELECT * FROM device_categories LIMIT 5`);
  console.log(`\n=== device_categories (${r2.rows.length} rows shown) ===`);
  for (const x of r2.rows) console.log('  ' + JSON.stringify(x));

  await c.end();
})().catch(e => console.error('Error:', e.message));
