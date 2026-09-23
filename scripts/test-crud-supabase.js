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
  console.log('✅ Conectado ao Supabase\n');

  // CREATE
  const ins = await client.query(`
    INSERT INTO test_playlists (name, description)
    VALUES ('Playlist Teste CRUD', 'Teste de conexao direta')
    RETURNING *
  `);
  const id = ins.rows[0].id;
  console.log('✅ CREATE:', ins.rows[0].name, '| ID:', id);

  // READ ALL
  const all = await client.query('SELECT * FROM test_playlists ORDER BY created_at DESC LIMIT 5');
  console.log('✅ READ ALL:', all.rows.length, 'playlists');
  all.rows.forEach(r => console.log('   -', r.name, '|', r.id.slice(0, 8)));

  // READ ONE
  const one = await client.query('SELECT * FROM test_playlists WHERE id = $1', [id]);
  console.log('✅ READ ONE:', one.rows[0].name, '|', one.rows[0].description);

  // UPDATE
  const upd = await client.query(
    'UPDATE test_playlists SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    ['Playlist Atualizada via CRUD', id]
  );
  console.log('✅ UPDATE:', upd.rows[0].name);

  // DELETE
  const del = await client.query('DELETE FROM test_playlists WHERE id = $1 RETURNING id', [id]);
  console.log('✅ DELETE: ID', del.rows[0].id);

  await client.end();
  console.log('\n✅ CRUD completo funcionou!');
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
