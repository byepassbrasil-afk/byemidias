const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  // Create profile for the admin user
  await client.query(`
    INSERT INTO profiles (id, full_name, role, created_at, updated_at)
    VALUES ('1c877912-485a-4df0-a863-daeb70631416', 'Gabriel Admin', 'super_admin', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin', full_name = 'Gabriel Admin', updated_at = NOW()
  `);

  console.log('Profile created with super_admin role');
  await client.end();
}

run().catch(e => console.error('Error:', e.message));
