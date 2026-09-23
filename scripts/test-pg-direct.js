const { Client } = require('pg');

const HOST = 'byemidias-supabase-2f9293-2-25-238-133.sslip.io';
const PASSWORD = 'b85idmclmfmicq1gyighd8a4hqhy078r';

async function main() {
  const client = new Client({
    host: HOST,
    port: 5432,
    user: 'postgres',
    password: PASSWORD,
    database: 'postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();

    // Check profiles table
    const profiles = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `);
    console.log('📋 Tabela profiles:');
    profiles.rows.forEach(c => console.log('  -', c.column_name, ':', c.data_type));

    // Check if we have our users table or profiles
    const users = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'profiles', 'organizations')
    `);
    console.log('\n📋 Tabelas de usuario/organizacao:');
    users.rows.forEach(t => console.log('  -', t.table_name));

    await client.end();
  } catch (e) {
    console.error('❌ Erro:', e.message.split('\n')[0]);
    if (e.code) console.error('Codigo:', e.code);
  }
}

main();
