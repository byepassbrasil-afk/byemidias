const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:89ffmkc6l9da0wstmpjt5vddltyucrh4@byemidias-supabase-2f9293-2-25-238-133.sslip.io:5432/postgres?sslmode=require';

async function main() {
  console.log('Conectando ao Supabase...');
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Conectado!');

    const result = await client.query('SELECT NOW()');
    console.log('Hora do servidor:', result.rows[0].now);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n📋 Tabelas no banco:', tables.rows.length);
    tables.rows.forEach(t => console.log('  -', t.table_name));

    if (tables.rows.length === 0) {
      console.log('\n⚠️  Banco vazio! Precisa criar o schema.');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  } finally {
    await client.end();
  }
}

main();
