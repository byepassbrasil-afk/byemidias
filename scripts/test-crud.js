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

  // Check if playlists table exists
  const t = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%playlist%'");
  console.log('Playlist tables:', JSON.stringify(t.rows));

  // Create a simple playlists table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS test_playlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ Tabela test_playlists criada ou já existe');

  // INSERT
  const ins = await client.query(`
    INSERT INTO test_playlists (name, description) VALUES ('Playlist Teste', 'Descricao teste') RETURNING *
  `);
  const playlistId = ins.rows[0].id;
  console.log('✅ INSERT:', ins.rows[0].id, ins.rows[0].name);

  // SELECT
  const sel = await client.query('SELECT * FROM test_playlists WHERE id = $1', [playlistId]);
  console.log('✅ SELECT:', sel.rows[0].name);

  // UPDATE
  const upd = await client.query('UPDATE test_playlists SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['Playlist Atualizada', playlistId]);
  console.log('✅ UPDATE:', upd.rows[0].name);

  // DELETE
  const del = await client.query('DELETE FROM test_playlists WHERE id = $1 RETURNING id', [playlistId]);
  console.log('✅ DELETE:', del.rows[0].id);

  await client.end();
  console.log('\n✅ CRUD completo funcionou!');
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
