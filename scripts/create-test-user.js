const { Client } = require('pg');
const bcrypt = require('bcryptjs');
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
  console.log('✅ Conectado\n');

  const email = 'teste@byemidias.com';
  const senha = 'Teste123456';
  const passwordHash = await bcrypt.hash(senha, 10);

  // Check if exists
  const exist = await client.query('SELECT id FROM profiles WHERE email = $1', [email]);
  if (exist.rows.length > 0) {
    console.log('⚠️  Usuario ja existe, deletando...');
    await client.query('DELETE FROM profiles WHERE email = $1', [email]);
  }

  const profileId = require('crypto').randomUUID();
  const orgId = require('crypto').randomUUID();

  // Create profile first
  await client.query(`
    INSERT INTO profiles (id, user_id, email, full_name, role, status, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [profileId, profileId, email, 'Usuario Teste', 'admin', 'active', passwordHash]);
  console.log('✅ Profile criado:', profileId);

  // Create org with owner_id = profile.id
  await client.query(`
    INSERT INTO organizations (id, name, slug, status, plan, max_devices, owner_id)
    VALUES ($1, 'Byemidias Teste', 'byemidias-teste', 'active', 'free', 10, $2)
  `, [orgId, profileId]);
  console.log('✅ Organization criada:', orgId);

  // Update profile with org_id
  await client.query('UPDATE profiles SET organization_id = $1 WHERE id = $2', [orgId, profileId]);

  console.log('\n✅ Usuario criado com sucesso!');
  console.log('   Email:', email);
  console.log('   Senha:', senha);
  console.log('   Profile ID:', profileId);
  console.log('   Org ID:', orgId);

  // Verify login works
  const [profile] = await client.query('SELECT * FROM profiles WHERE email = $1', [email]);
  const valid = await bcrypt.compare(senha, profile.password_hash);
  console.log('\n🔐 Login test:', valid ? 'OK ✅' : 'FALHOU ❌');

  await client.end();
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
