/**
 * Cria a collection media_folders no PocketBase e adiciona folder_id em media.
 * Idempotente: se já existe, só atualiza/adiciona campos.
 *
 * PocketBase >= 0.22 usa `fields` (não `schema`) e cada field precisa ter um `id` único.
 */

const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8').replace(/\r/g, '');
const PB_URL = env.match(/^PB_URL=(.+)$/m)[1].trim();
const PB_ADMIN_EMAIL = env.match(/^PB_ADMIN_EMAIL=(.+)$/m)[1].trim();
const PB_ADMIN_PASSWORD = env.match(/^PB_ADMIN_PASSWORD=(.+)$/m)[1].trim();
const pb = new PocketBase(PB_URL);

function mkField(name, type, opts = {}) {
  return {
    id: type + '_' + Math.random().toString(36).slice(2, 12),
    name,
    type,
    presentable: false,
    required: !!opts.required,
    system: false,
    hidden: !!opts.hidden,
    ...opts,
  };
}

(async () => {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);

  // 1. Cria/atualiza collection media_folders
  console.log('📁 Verificando collection media_folders...');
  let foldersCol;
  let needsCreate = false;
  try {
    foldersCol = await pb.collections.getOne('media_folders');
    const hasFields = (foldersCol.fields || []).filter(f => !f.system);
    if (hasFields.length === 0) {
      needsCreate = true; // só tem o id system, recria
    } else {
      console.log('  Já tem fields customizados:', hasFields.map(f => f.name).join(', '));
    }
  } catch {
    needsCreate = true;
  }

  if (needsCreate) {
    // delete e recria (mais simples que tentar update com schema quebrado)
    if (foldersCol) {
      try { await pb.collections.delete(foldersCol.id); console.log('  🗑️ Removido collection quebrada'); } catch {}
    }
    console.log('  Criando collection com fields...');
    foldersCol = await pb.collections.create({
      name: 'media_folders',
      type: 'base',
      fields: [
        mkField('organization_id', 'text', { required: true }),
        mkField('name', 'text', { required: true }),
        mkField('parent_id', 'text'),
        mkField('color', 'text'),
        mkField('icon', 'text'),
        mkField('order', 'number'),
        mkField('created_by', 'text'),
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });
    console.log('  ✅ Criada:', foldersCol.id);
  }

  // 2. Adiciona folder_id em media se não tiver
  console.log('\n📁 Verificando campo folder_id em media...');
  try {
    const mediaCol = await pb.collections.getOne('pbc_2708086759').catch(async () => {
      return await pb.collections.getOne('media');
    });
    const userFields = (mediaCol.fields || []).filter(f => !f.system);
    const existingNames = userFields.map(f => f.name);
    console.log('  Media fields atuais:', existingNames.join(', '));
    const hasFolderId = existingNames.includes('folder_id');
    if (!hasFolderId) {
      console.log('  Adicionando folder_id...');
      await pb.collections.update(mediaCol.id, {
        fields: [...mediaCol.fields, mkField('folder_id', 'text')],
      });
      console.log('  ✅ Adicionado');
    } else {
      console.log('  Já existe');
    }
  } catch (e) {
    console.log('  ⚠️  Não consegui atualizar media:', e.message);
  }

  console.log('\n✅ Schema pronto!');
  // Mostrar resultado final
  const f = await pb.collections.getOne('media_folders');
  console.log('media_folders fields:', (f.fields || []).map(x => x.name).join(', '));
})().catch(e => { console.error('Erro:', e); process.exit(1); });
