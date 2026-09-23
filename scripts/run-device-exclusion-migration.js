const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join('apps', 'web', '.env.local'), 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('🔧 Adicionando excluded_device_ids no media...');
  await c.query(`ALTER TABLE media ADD COLUMN IF NOT EXISTS excluded_device_ids uuid[] DEFAULT NULL`);
  console.log('  ✅ excluded_device_ids');
  await c.end();
  console.log('\n✅ Migration concluída!');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
