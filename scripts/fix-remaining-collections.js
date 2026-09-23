const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function authPB() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  return pb;
}

// Collections que precisam de mais campos (estão só com id)
const collectionsToFix = {
  partner_access: [
    { name: 'partner_id', type: 'text' },
    { name: 'organization_id', type: 'text' },
    { name: 'role', type: 'text' },
  ],
  partner_payments: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'text' },
    { name: 'due_date', type: 'date' },
  ],
  partner_invoices: [
    { name: 'partner_id', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'status', type: 'text' },
    { name: 'due_date', type: 'date' },
  ],
  partner_media_uploads: [
    { name: 'partner_id', type: 'text' },
    { name: 'media_id', type: 'text' },
    { name: 'status', type: 'text' },
  ],
  partners: [
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'status', type: 'text' },
  ],
};

async function main() {
  const pb = await authPB();

  for (const [name, newFields] of Object.entries(collectionsToFix)) {
    try {
      const col = await pb.collections.getOne(name);
      const existingFields = col.fields || [];
      const existingFieldNames = new Set(existingFields.map(f => f.name));

      const fieldsToAdd = newFields.filter(f => !existingFieldNames.has(f.name));
      if (fieldsToAdd.length === 0) {
        console.log(`✓ ${name} já tem todos os campos`);
        continue;
      }

      const allFields = [...existingFields, ...fieldsToAdd];

      await pb.collections.update(col.id, { fields: allFields });
      console.log(`✅ ${name}: +${fieldsToAdd.length} campos (${allFields.length} total)`);
    } catch (e) {
      console.error(`❌ ${name}:`, e.message);
    }
  }

  console.log('\n✅ Concluído!');
}

main().catch(console.error);
