const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  await client.query('ALTER TABLE media ALTER COLUMN organization_id DROP NOT NULL');
  console.log('media.organization_id is now nullable');
  await client.end();
}

run().catch(e => console.error('Error:', e.message));
