const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  const drops = [
    'DROP POLICY IF EXISTS "media_read_all" ON storage.objects',
    'DROP POLICY IF EXISTS "media_insert_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "media_insert_service" ON storage.objects',
    'DROP POLICY IF EXISTS "media_delete_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "media_delete_service" ON storage.objects',
    'DROP POLICY IF EXISTS "templates_read_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "templates_insert_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "templates_delete_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "templates_insert_service" ON storage.objects',
    'DROP POLICY IF EXISTS "templates_delete_service" ON storage.objects',
    'DROP POLICY IF EXISTS "branding_read_all" ON storage.objects',
    'DROP POLICY IF EXISTS "branding_insert_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "branding_delete_auth" ON storage.objects',
    'DROP POLICY IF EXISTS "branding_insert_service" ON storage.objects',
    'DROP POLICY IF EXISTS "branding_delete_service" ON storage.objects',
  ];

  const creates = [
    `CREATE POLICY "media_read_all" ON storage.objects FOR SELECT USING (bucket_id = 'media')`,
    `CREATE POLICY "media_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media')`,
    `CREATE POLICY "media_insert_service" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'media')`,
    `CREATE POLICY "media_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media')`,
    `CREATE POLICY "media_delete_service" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'media')`,
    `CREATE POLICY "templates_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'templates')`,
    `CREATE POLICY "templates_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'templates')`,
    `CREATE POLICY "templates_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'templates')`,
    `CREATE POLICY "templates_insert_service" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'templates')`,
    `CREATE POLICY "templates_delete_service" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'templates')`,
    `CREATE POLICY "branding_read_all" ON storage.objects FOR SELECT USING (bucket_id = 'branding')`,
    `CREATE POLICY "branding_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding')`,
    `CREATE POLICY "branding_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding')`,
    `CREATE POLICY "branding_insert_service" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'branding')`,
    `CREATE POLICY "branding_delete_service" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'branding')`,
  ];

  let ok = 0, fail = 0;

  for (const sql of drops) {
    try { await client.query(sql); } catch (e) { /* ok if not exists */ }
  }

  for (const sql of creates) {
    try {
      await client.query(sql);
      ok++;
    } catch (e) {
      console.log('Error:', sql.substring(0, 60), '->', e.message.substring(0, 100));
      fail++;
    }
  }

  console.log(`Storage policies: ${ok} created, ${fail} failed`);

  // Verify
  const { rows } = await client.query(`SELECT policyname FROM pg_policies WHERE schemaname = 'storage' ORDER BY policyname`);
  console.log('\nAll storage policies:');
  rows.forEach(r => console.log('  ' + r.policyname));

  await client.end();
}

run().catch(e => console.error('FATAL:', e.message));
