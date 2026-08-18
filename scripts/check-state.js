const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'devices' ORDER BY ordinal_position");
  console.log('Device columns:', cols.rows.map(r => r.column_name).join(', '));

  const devices = await c.query('SELECT id, name, status FROM devices LIMIT 10');
  console.log('Devices:', JSON.stringify(devices.rows));

  const pd = await c.query('SELECT * FROM partner_devices');
  console.log('Partner devices:', JSON.stringify(pd.rows));

  const partners = await c.query('SELECT id, username, display_name, status FROM partner_access');
  console.log('Partners:', JSON.stringify(partners.rows));

  const playlists = await c.query('SELECT id, name FROM playlists LIMIT 5');
  console.log('Playlists:', JSON.stringify(playlists.rows));

  await c.end();
})().catch(e => console.error('FATAL:', e.message));
