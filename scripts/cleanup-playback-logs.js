const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  // Deleta todos os playback_logs (começa do zero)
  const all = await pb.collection('playback_logs').getList(1, 1000);
  console.log('Total playback_logs antes:', all.totalItems);

  let deleted = 0;
  for (const log of all.items) {
    try {
      await pb.collection('playback_logs').delete(log.id);
      deleted++;
      if (deleted % 50 === 0) console.log(`Deleted ${deleted}...`);
    } catch (e) {}
  }
  console.log(`Deleted ${deleted} registros`);
}

main().catch(console.error);
