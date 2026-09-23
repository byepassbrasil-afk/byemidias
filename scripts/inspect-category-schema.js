const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const show = async (label, table) => {
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n=== ${label} (${table}) ===`);
    for (const x of r.rows) console.log(`  ${x.column_name} (${x.data_type})`);
  };

  await show('Categorias', 'media_categories');
  await show('Organizações', 'organizations');
  await show('Mídia', 'media');
  await show('Devices', 'devices');

  // Categorias existentes
  const r4 = await c.query(`SELECT id, name, icon, color, is_default, is_global FROM media_categories ORDER BY name`);
  console.log(`\n=== Categorias existentes (${r4.rows.length}) ===`);
  for (const x of r4.rows) console.log(`  ${x.icon||''} ${x.name} | default=${x.is_default} global=${x.is_global}`);

  // Org atual
  const r5 = await c.query(`SELECT id, name, slug, status FROM organizations ORDER BY name`);
  console.log(`\n=== Organizações (${r5.rows.length}) ===`);
  for (const x of r5.rows) console.log(`  ${x.name} (${x.slug}) status=${x.status}`);

  await c.end();
})().catch(e => console.error('Error:', e.message));
