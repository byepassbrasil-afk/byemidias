/**
 * Fix slot media positions.
 *
 * PROBLEMA: quando um parceiro adicionava mídia a um slot via modify route,
 * o código buscava MAX(position) de TODOS os itens da playlist como fallback,
 * fazendo as mídias do slot receberem posições altas (5, 6, 7...)
 * em vez de começarem em 0 dentro do slot.
 *
 * RESULTADO: slot_order=1 (posição 2 na playlist) mas mídias do parceiro
 * ficam em posição 5, 6 — o player as mostra depois dos itens comuns,
 * não dentro do slot reservado.
 *
 * SOLUÇÃO: para cada slot, renumerar as posições dos playlist_items
 * belonging a esse slot para começar em 0, dentro do slot.
 *
 * Uso: node scripts/fix-slot-positions.js [playlist_id]
 *   Sem argumento = processa TODOS os slots com posições conflitantes
 *   Com playlist_id = processa só essa playlist
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Ler DATABASE_URL do .env.local
const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch ? dbMatch[1].trim() : null;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada em apps/web/.env.local');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetPlaylistId = process.argv[2];

  try {
    if (targetPlaylistId) {
      console.log(`🎯 Corrigindo playlist: ${targetPlaylistId}`);
      await fixPlaylist(client, targetPlaylistId);
    } else {
      console.log('🔍 Procurando slots com posições conflitantes...');
      await fixAllConflicts(client);
    }
  } finally {
    await client.end();
  }
}

async function fixPlaylist(client, playlistId) {
  // Buscar todos os slots dessa playlist
  const slots = await client.query(
    `SELECT id, slot_order, partner_access_id
     FROM playlist_slots
     WHERE playlist_id = $1
     ORDER BY slot_order ASC`,
    [playlistId]
  );

  if (slots.rows.length === 0) {
    console.log('  Nenhum slot encontrado nessa playlist.');
    return;
  }

  // Para cada slot, corrigir posições dos itens
  for (const slot of slots.rows) {
    const items = await client.query(
      `SELECT id, position, media_id
       FROM playlist_items
       WHERE playlist_id = $1 AND slot_id = $2
       ORDER BY position ASC`,
      [playlistId, slot.id]
    );

    if (items.rows.length === 0) {
      console.log(`  Slot ${slot.id} (order=${slot.slot_order}): vazio, ok`);
      continue;
    }

    let hasConflict = false;
    for (const item of items.rows) {
      if (item.position >= items.rows.length) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      console.log(`  🔧 Slot ${slot.id} (slot_order=${slot.slot_order}): ${items.rows.length} mídias com posições erradas`);
      for (let i = 0; i < items.rows.length; i++) {
        const item = items.rows[i];
        if (item.position !== i) {
          await client.query(
            `UPDATE playlist_items SET position = $1 WHERE id = $2`,
            [i, item.id]
          );
          console.log(`     posição ${item.position} → ${i} (${item.media_id})`);
        }
      }
    } else {
      console.log(`  ✅ Slot ${slot.id} (slot_order=${slot.slot_order}): posições já corretas`);
    }
  }

  // Bump content_version de todos os devices dessa playlist
  const devices = await client.query(
    `UPDATE devices SET content_version = content_version + 1
     WHERE organization_id IN (SELECT organization_id FROM playlists WHERE id = $1)
     RETURNING id`,
    [playlistId]
  );
  if (devices.rows.length > 0) {
    console.log(`  📡 content_version bump em ${devices.rows.length} device(s)`);
  }
}

async function fixAllConflicts(client) {
  // Encontrar slots que têm mídias com posições >= número de itens do slot
  // (isso indica que estão competindo com itens comuns)
  const result = await client.query(`
    SELECT
      ps.id as slot_id,
      ps.playlist_id,
      ps.slot_order,
      ps.partner_access_id,
      p.name as playlist_name,
      COUNT(pi.id) as item_count,
      MAX(pi.position) as max_position
    FROM playlist_slots ps
    JOIN playlists p ON p.id = ps.playlist_id
    LEFT JOIN playlist_items pi ON pi.slot_id = ps.id
    GROUP BY ps.id, ps.playlist_id, ps.slot_order, ps.partner_access_id, p.name
    HAVING MAX(pi.position) >= COUNT(pi.id)
       OR MAX(pi.position) > 100
    ORDER BY ps.playlist_id, ps.slot_order
  `);

  if (result.rows.length === 0) {
    console.log('✅ Nenhum conflito de posição encontrado.');
    return;
  }

  console.log(`⚠️  Encontrados ${result.rows.length} slot(s) com posições conflitantes:\n`);

  for (const row of result.rows) {
    console.log(`  Playlist "${row.playlist_name}" (${row.playlist_id})`);
    console.log(`    Slot: ${row.slot_id} | slot_order: ${row.slot_order} | mídias: ${row.item_count} | max_pos: ${row.max_position}`);
  }

  console.log('\nCorrigindo todos...\n');

  const affectedPlaylists = new Set();

  for (const row of result.rows) {
    affectedPlaylists.add(row.playlist_id);

    const items = await client.query(
      `SELECT id, position, media_id
       FROM playlist_items
       WHERE playlist_id = $1 AND slot_id = $2
       ORDER BY position ASC`,
      [row.playlist_id, row.slot_id]
    );

    console.log(`🔧 Corrigindo slot ${row.slot_id} (slot_order=${row.slot_order}) em "${row.playlist_name}"`);
    for (let i = 0; i < items.rows.length; i++) {
      const item = items.rows[i];
      if (item.position !== i) {
        await client.query(
          `UPDATE playlist_items SET position = $1 WHERE id = $2`,
          [i, item.id]
        );
        console.log(`     posição ${item.position} → ${i}`);
      }
    }
    console.log(`   ✅ ${items.rows.length} mídias corrigidas`);
  }

  // Bump content_version de todos os devices afetados
  for (const playlistId of affectedPlaylists) {
    const devices = await client.query(
      `UPDATE devices SET content_version = content_version + 1
       WHERE organization_id IN (SELECT organization_id FROM playlists WHERE id = $1)
       RETURNING id`,
      [playlistId]
    );
    if (devices.rows.length > 0) {
      console.log(`  📡 Playlist ${playlistId}: content_version bump em ${devices.rows.length} device(s)`);
    }
  }

  console.log('\n✅ Correção concluída!');
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
