const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  const partnerId = '976dc924-3f23-4202-bde2-c628a93fed09';
  const deviceId = '286e1731-920d-4246-b747-c32f6ded179d';
  const playlistId = '00bb81bb-e304-4b91-8236-0ef3fe8fecf3';

  await c.query(
    'INSERT INTO partner_devices (partner_access_id, device_id, playlist_id) VALUES ($1, $2, $3)',
    [partnerId, deviceId, playlistId]
  );
  console.log('Assigned!');

  const pd = await c.query('SELECT * FROM partner_devices');
  console.log('PD:', JSON.stringify(pd.rows));

  await c.end();
})().catch(e => console.error('FATAL:', e.message));
