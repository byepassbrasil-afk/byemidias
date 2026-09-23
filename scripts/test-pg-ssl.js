const { Client } = require('pg');
const HOST = 'byemidias-supabase-2f9293-2-25-238-133.sslip.io';
const PASSWORD = 'b85idmclmfmicq1gyighd8a4hqhy078r';

const client = new Client({
  host: HOST,
  port: 5432,
  user: 'postgres',
  password: PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function main() {
  try {
    console.log('Conectando com SSL...');
    await client.connect();
    console.log('✅ CONECTADO COM SSL!');
    const res = await client.query('SELECT current_user');
    console.log('User:', res.rows[0].current_user);
    await client.end();
  } catch (e) {
    console.error('❌ Erro SSL:', e.message);
  }
}

main();
