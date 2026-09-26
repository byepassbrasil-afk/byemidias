const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);

(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

  const items = await pb.collection('media').getList(1, 100);
  console.log(`Total: ${items.items.length}`);

  let fixed = 0;
  let deleted = 0;

  for (const i of items.items) {
    const ext = (i.name || '').split('.').pop()?.toLowerCase();
    let correctType = i.type;

    // Detecta pelo nome do arquivo
    if (ext === 'webp' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'avif') {
      correctType = 'image';
    } else if (ext === 'mp4' || ext === 'webm' || ext === 'mov' || ext === 'avi' || ext === 'wmv' || ext === 'mkv') {
      correctType = 'video';
    }

    // Registro 100% vazio (teste quebrado) → deletar
    if (!i.name && !i.url) {
      console.log(`🗑️  Deletando registro vazio ${i.id}`);
      await pb.collection('media').delete(i.id);
      deleted++;
      continue;
    }

    // Tipo errado → corrigir
    if (correctType !== i.type) {
      console.log(`🔧 ${i.id.slice(0,8)}: ${i.name} → ${i.type} → ${correctType}`);
      await pb.collection('media').update(i.id, { type: correctType });
      fixed++;
    }
  }

  console.log(`\n✅ ${fixed} corrigidos, ${deleted} deletados`);
})();
