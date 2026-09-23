const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:89ffmkc6l9da0wstmpjt5vddltyucrh4@byemidias-supabase-2f9293-2-25-238-133.sslip.io:5432/postgres?sslmode=require',
  connectionTimeoutMillis: 10000,
});

async function main() {
  try {
    console.log('Conectando...');
    await client.connect();
    console.log('✅ Conectado!');

    // Testa query
    const res = await client.query('SELECT 1 as test');
    console.log('Query funcionou:', res.rows);

    // Verifica listen_addresses atual
    const listenResult = await client.query("SHOW listen_addresses");
    console.log('listen_addresses atual:', listenResult.rows[0]);

    // Verifica pg_hba.conf
    const hbaResult = await client.query("SELECT * FROM pg_hba_file_rules WHERE type = 'host'");
    console.log('pg_hba rules:', hbaResult.rows);

    await client.end();
    console.log('Conexão fechada.');
  } catch (e) {
    console.error('❌ Erro:', e.message);
    if (e.code) console.error('Código:', e.code);
  }
}

main();
