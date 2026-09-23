const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io');
pb.autoCancellation(false);
async function main() {
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
  const col = await pb.collections.getOne('campaign_playlists');
  console.log('Fields:', col.fields.map(f => f.name + ':' + f.type).join(', '));
}
main().catch(e => console.error('ERR:', e.message));
