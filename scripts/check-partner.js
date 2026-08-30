/**
 * Check partner_access credentials in the database.
 * Verifica se o parceiro existe, está ativo, e se a senha está correta.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch ? dbMatch[1].trim() : null;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const orgSlug = process.argv[2] || 'byemidias';
  const username = process.argv[3];

  // Find organization
  const orgResult = await client.query(
    `SELECT id, name, slug, status FROM organizations WHERE slug = $1`,
    [orgSlug]
  );

  if (orgResult.rows.length === 0) {
    console.log(`❌ Organização com slug "${orgSlug}" não encontrada.`);
    await client.end();
    return;
  }

  const org = orgResult.rows[0];
  console.log(`✅ Organização: "${org.name}" (${org.id})`);
  console.log(`   Slug: ${org.slug} | Status: ${org.status}`);

  // List all partners for this org
  const partnersResult = await client.query(
    `SELECT id, username, display_name, status, created_at FROM partner_access WHERE organization_id = $1 ORDER BY created_at`,
    [org.id]
  );

  console.log(`\n👥 Parceiros na organização (${partnersResult.rows.length}):`);
  for (const p of partnersResult.rows) {
    console.log(`   - "${p.display_name}" (@${p.username}) | ID: ${p.id} | Status: ${p.status} | Criado: ${p.created_at}`);
  }

  // Check specific username
  if (username) {
    console.log(`\n🔍 Verificando usuário: @${username}`);
    const userResult = await client.query(
      `SELECT id, username, display_name, password_hash, status FROM partner_access WHERE organization_id = $1 AND username = $2`,
      [org.id, username.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      console.log(`   ❌ Usuário não encontrado.`);
      console.log(`   Dica: o código salva o username em lowercase. Você tentou "${username.toLowerCase().trim()}"?`);
    } else {
      const user = userResult.rows[0];
      console.log(`   ✅ Encontrado: @${user.username} | Status: ${user.status}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Hash da senha: ${user.password_hash.substring(0, 20)}...`);
      if (user.status !== 'active') {
        console.log(`   ⚠️  ATENÇÃO: conta não está active! Status: ${user.status}`);
      }
    }
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
