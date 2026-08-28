import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql, { bumpContentVersion } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { playlist_id, action, media_id, items, slot_id } = await request.json();

    if (!playlist_id || !action) {
      return NextResponse.json({ error: 'playlist_id e action obrigatórios' }, { status: 400 });
    }

    let hasAccess = false;

    if (slot_id) {
      const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slot_id} AND partner_access_id = ${session.partnerAccessId} AND playlist_id = ${playlist_id}`;
      if (slot) hasAccess = true;
    }

    if (!hasAccess) {
      const [pd] = await sql`SELECT id FROM partner_devices WHERE partner_access_id = ${session.partnerAccessId} AND playlist_id = ${playlist_id}`;
      if (pd) hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem acesso a esta playlist' }, { status: 403 });
    }

    // Buscar organization_id da playlist para bump de versão
    const [plRow] = await sql`SELECT organization_id FROM playlists WHERE id = ${playlist_id}`;
    const orgId = plRow?.organization_id as string | undefined;

    if (action === 'add' && media_id) {
      // Bug fix: maxPos deve considerar apenas itens DO MESMO SLOT, não todos da playlist.
      // Antes o fallback buscava MAX(position) de TODOS os itens, fazendo slot items
      // competirem com itens comuns e quebrando o merge do player.
      let maxPos = -1;

      if (slot_id) {
        // Primeiro: posição máxima dentro do slot específico
        const [maxItemInSlot] = await sql`SELECT position FROM playlist_items WHERE playlist_id = ${playlist_id} AND slot_id = ${slot_id} ORDER BY position DESC LIMIT 1`;
        if (maxItemInSlot) maxPos = maxItemInSlot.position;
      }

      // Se slot vazio, usa a próxima posição livre DENTRO DO SLOT (começa em 0)
      // NÃO usar fallback que olha itens comuns — isso quebra a ordenação do player.

      await sql`
        INSERT INTO playlist_items (playlist_id, media_id, position, duration, transition, slot_id)
        VALUES (${playlist_id}, ${media_id}, ${maxPos + 1}, 10, 'fade', ${slot_id || null})
      `;

      if (orgId) bumpContentVersion(orgId).catch(() => {});
    } else if (action === 'remove' && media_id) {
      const [itemToRemove] = await sql`SELECT id, slot_id FROM playlist_items WHERE playlist_id = ${playlist_id} AND media_id = ${media_id}`;
      if (itemToRemove) {
        const removedSlotId = itemToRemove.slot_id;
        await sql`DELETE FROM playlist_items WHERE id = ${itemToRemove.id}`;
        // Reordenar só os itens do mesmo slot (não mecher nos comuns)
        if (removedSlotId) {
          const remaining = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${playlist_id} AND slot_id = ${removedSlotId} ORDER BY position ASC`;
          for (let i = 0; i < remaining.length; i++) {
            await sql`UPDATE playlist_items SET position = ${i} WHERE id = ${remaining[i].id}`;
          }
        }
        if (orgId) bumpContentVersion(orgId).catch(() => {});
      }
    } else if (action === 'reorder' && items) {
      for (const item of items) {
        await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id}`;
      }
      if (orgId) bumpContentVersion(orgId).catch(() => {});
    }

    return NextResponse.json({ success: true, playlist_id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/partner/playlists/modify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
