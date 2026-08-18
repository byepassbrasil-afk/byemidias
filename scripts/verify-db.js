const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await c.connect();
  
  const funcs = await c.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name");
  console.log('Functions:');
  funcs.rows.forEach(r => console.log('  ' + r.routine_name));
  console.log('Total functions:', funcs.rows.length);
  
  const triggers = await c.query("SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table");
  console.log('\nTriggers:');
  triggers.rows.forEach(r => console.log('  ' + r.trigger_name + ' ON ' + r.event_object_table));
  console.log('Total triggers:', triggers.rows.length);

  const policies = await c.query("SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' ORDER BY tablename");
  console.log('\nPolicies:');
  policies.rows.forEach(r => console.log('  ' + r.policyname + ' ON ' + r.tablename));
  console.log('Total policies:', policies.rows.length);
  
  await c.end();
}
run().catch(e => console.error(e.message));
