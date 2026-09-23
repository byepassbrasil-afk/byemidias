// Patch collections: adiciona fields em collections que estão vazias
const PocketBase = require('pocketbase/cjs');
const fs = require('fs');
const path = require('path');

try {
  const env = fs.readFileSync(path.join(__dirname, '..', 'apps', 'web', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const pb = new PocketBase(process.env.PB_URL);
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

const COLLECTIONS = require('./pb-collections-list.js');

(async () => {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('✓ Autenticado\n');

  let success = 0, fail = 0;

  for (const def of COLLECTIONS) {
    try {
      const col = await pb.collections.getOne(def.name);
      const existingFields = new Set((col.fields || []).map(f => f.name));
      const missing = (def.fields || []).filter(f => !existingFields.has(f.name));

      if (missing.length === 0) {
        console.log(`  ✓ [${def.name}] já tem ${existingFields.size} fields`);
        success++;
        continue;
      }

      const allFields = [...(col.fields || []), ...missing];
      await pb.collections.update(col.id, { fields: allFields });
      console.log(`  + [${def.name}] adicionados ${missing.length} fields (total ${allFields.length})`);
      success++;
    } catch (e) {
      console.log(`  ✗ [${def.name}] ERRO: ${e.message}`);
      if (e.data) console.log('    ' + JSON.stringify(e.data).slice(0, 300));
      fail++;
    }
  }

  console.log(`\n✓ ${success} atualizadas, ${fail} falhas.`);
})();
