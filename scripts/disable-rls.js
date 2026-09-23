const { Client } = require('pg');
const HOST = 'byemidias-supabase-2f9293-2-25-238-133.sslip.io';
const PASSWORD = 'b85idmclmfmicq1gyighd8a4hqhy078r';

const client = new Client({
  host: HOST,
  port: 5432,
  user: 'postgres',
  password: PASSWORD,
  database: 'postgres',
  ssl: false,
});

async function main() {
  await client.connect();

  // Disable RLS on key tables
  const tables = ['profiles', 'organizations', 'test_playlists', 'playlists', 'campaigns'];

  for (const table of tables) {
    // Check if table exists
    const exists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    `, [table]);

    if (exists.rows.length === 0) {
      console.log(`⚠️  Tabela ${table} nao existe, pulando`);
      continue;
    }

    // Disable RLS
    await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    console.log(`✅ RLS desabilitado em ${table}`);

    // Make table publicly readable/writable via anon role
    await client.query(`DROP POLICY IF EXISTS "Public read" ON ${table}`);
    await client.query(`DROP POLICY IF EXISTS "Public write" ON ${table}`);
    await client.query(`CREATE POLICY "Public read" ON ${table} FOR SELECT USING (true)`);
    await client.query(`CREATE POLICY "Public write" ON ${table} FOR ALL USING (true)`);
    console.log(`✅ Politicas publicas criadas em ${table}`);
  }

  console.log('\n✅ RLS desabilitado nas tabelas!');
  console.log('Agora o Supabase Studio deve mostrar os dados.');

  await client.end();
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
