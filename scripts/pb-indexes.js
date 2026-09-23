// Adiciona índices via PATCH na collection (que é suportado)
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

const COLLECTIONS = require('./pb-collections-list.js');
const pb = new PocketBase(process.env.PB_URL);

(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  console.log('✓ Autenticado\n');

  let ok = 0, fail = 0;
  for (const def of COLLECTIONS) {
    if (!def.indexes || def.indexes.length === 0) continue;

    try {
      const col = await pb.collections.getOne(def.name);
      const existingIdx = (col.indexes || []).map(i => i.sql || '').join('|');
      const existingSet = new Set();
      const newIdx = def.indexes.map(sql => {
        const m = sql.match(/INDEX\s+(\w+)/i);
        if (m) existingSet.add(m[1].toLowerCase());
        return { sql };
      }).filter(idx => {
        const m = idx.sql.match(/INDEX\s+(\w+)/i);
        return !(m && existingSet.has(m[1].toLowerCase())) && !existingIdx.toLowerCase().includes(m[1].toLowerCase());
      });

      if (newIdx.length === 0) {
        console.log(`  · [${def.name}] todos os ${def.indexes.length} índices já existem`);
        ok += def.indexes.length;
        continue;
      }

      const merged = [...(col.indexes || []), ...newIdx];
      await pb.collections.update(col.id, { indexes: merged });
      console.log(`  ✓ [${def.name}] +${newIdx.length} índices`);
      ok += newIdx.length;
    } catch (e) {
      console.log(`  ✗ [${def.name}] ${e.message}`);
      fail++;
    }
  }
  console.log(`\n✓ ${ok} índices processados, ${fail} falhas.`);
})();
