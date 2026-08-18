const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();

  // Check existing tables
  const r = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log('Existing tables:', r.rows.map(x => x.tablename));

  // Try creating organizations directly
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      settings JSONB DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    console.log('organizations CREATE: OK');
  } catch(e) {
    console.log('organizations CREATE FAILED:', e.message.substring(0, 200));
  }

  await client.end();
}
run();
