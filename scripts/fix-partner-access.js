const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  const col = await pb.collections.getOne('partner_access');
  const existingFields = col.fields || [];
  const existingNames = new Set(existingFields.map(f => f.name));

  const newFields = [
    { name: 'username', type: 'text' },
    { name: 'display_name', type: 'text' },
    { name: 'email', type: 'text' },
  ].filter(f => !existingNames.has(f.name));

  if (newFields.length === 0) {
    console.log('partner_access já tem todos os campos');
    return;
  }

  const allFields = [...existingFields, ...newFields];
  await pb.collections.update(col.id, { fields: allFields });
  console.log(`✅ partner_access: +${newFields.length} campos`);
}

main().catch(console.error);
