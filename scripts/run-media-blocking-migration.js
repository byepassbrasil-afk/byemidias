const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('🔧 Adicionando colunas em media...');
  await c.query(`ALTER TABLE media ADD COLUMN IF NOT EXISTS excluded_category_ids uuid[] DEFAULT NULL`);
  await c.query(`ALTER TABLE media ADD COLUMN IF NOT EXISTS excluded_organization_ids uuid[] DEFAULT NULL`);
  console.log('  ✅ excluded_category_ids');
  console.log('  ✅ excluded_organization_ids');

  console.log('\n🔧 Adicionando coluna em organizations...');
  await c.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL`);
  console.log('  ✅ category_id (FK para categories)');

  // Verificar
  const r = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='media'
      AND column_name IN ('excluded_category_ids', 'excluded_organization_ids')
  `);
  console.log('\n📋 media (novas colunas):');
  for (const x of r.rows) console.log(`  ${x.column_name} (${x.data_type})`);

  const r2 = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organizations'
      AND column_name = 'category_id'
  `);
  console.log('\n📋 organizations (nova coluna):');
  for (const x of r2.rows) console.log(`  ${x.column_name} (${x.data_type})`);

  await c.end();
  console.log('\n✅ Migration concluída!');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
