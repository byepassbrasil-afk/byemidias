const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  const updates = {
    playlist_items: ['duration', 'transition'],
    playlist_slots: ['start_time', 'end_time'],
  };

  for (const [name, fieldsToAdd] of Object.entries(updates)) {
    const col = await pb.collections.getOne(name);
    const existingNames = new Set(col.fields.map(f => f.name));

    const newFields = fieldsToAdd
      .filter(f => !existingNames.has(f))
      .map(f => {
        if (f === 'duration') return { name: f, type: 'number' };
        if (f === 'transition') return { name: f, type: 'text' };
        if (f === 'start_time' || f === 'end_time') return { name: f, type: 'text' };
        return { name: f, type: 'text' };
      });

    if (newFields.length === 0) {
      console.log(`${name}: já tem todos os campos`);
      continue;
    }

    const allFields = [...col.fields, ...newFields];
    await pb.collections.update(col.id, { fields: allFields });
    console.log(`✅ ${name}: +${newFields.length} campos`);
  }
}

main().catch(console.error);
