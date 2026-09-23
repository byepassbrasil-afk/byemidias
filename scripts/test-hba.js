const { Client } = require('pg');
const client = new Client({
  host: 'byemidias-supabase-2f9293-2-25-238-133.sslip.io',
  port: 5432,
  user: 'postgres',
  password: 'b85idmclmfmicq1gyighd8a4hqhy078r',
  database: 'postgres',
  ssl: false,
});

async function main() {
  await client.connect();

  // Check pg_hba.conf
  const hba = await client.query('SHOW hba_file');
  console.log('hba_file:', hba.rows[0].hba_file);

  // Check current connections
  const conn = await client.query('SELECT client_addr, usename FROM pg_stat_activity WHERE datname = current_database()');
  console.log('Active connections:');
  conn.rows.forEach(r => console.log('  -', r.usename, 'from', r.client_addr || 'local'));

  await client.end();
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
