const PocketBase = require('pocketbase/cjs');
const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

  // Limpa test playlist
  const pls = await pb.collection('playlists').getFullList();
  for (const p of pls) {
    if (p.name === 'Test Playlist') {
      await pb.collection('playlists').delete(p.id);
      console.log('Deleted playlist:', p.id);
    }
  }

  // Limpa items do test playlist
  const items = await pb.collection('playlist_items').getFullList();
  for (const i of items) {
    if (i.playlist_id === 'kurhx39s8z8i2z3') {
      await pb.collection('playlist_items').delete(i.id);
      console.log('Deleted item:', i.id);
    }
  }

  // Limpa test media
  const media = await pb.collection('media').getFullList();
  for (const m of media) {
    if (m.name && m.name.includes('test-image')) {
      await pb.collection('media').delete(m.id);
      console.log('Deleted media:', m.id);
    }
  }
}

main().catch(console.error);
