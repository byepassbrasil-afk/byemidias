import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

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

    if (action === 'add' && media_id) {
      let maxPos = -1;

      if (slot_id) {
        const [maxItem] = await sql`SELECT position FROM playlist_items WHERE playlist_id = ${playlist_id} AND slot_id = ${slot_id} ORDER BY position DESC LIMIT 1`;
        if (maxItem) maxPos = maxItem.position;
      }

      if (maxPos < 0) {
        const [maxItem] = await sql`SELECT position FROM playlist_items WHERE playlist_id = ${playlist_id} ORDER BY position DESC LIMIT 1`;
        if (maxItem) maxPos = maxItem.position;
      }

      await sql`
        INSERT INTO playlist_items (playlist_id, media_id, position, duration, transition, slot_id)
        VALUES (${playlist_id}, ${media_id}, ${maxPos + 1}, 10, 'fade', ${slot_id || null})
      `;
    } else if (action === 'remove' && media_id) {
      const [itemToRemove] = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${playlist_id} AND media_id = ${media_id}`;
      if (itemToRemove) {
        await sql`DELETE FROM playlist_items WHERE id = ${itemToRemove.id}`;
        const remaining = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${playlist_id} ORDER BY position ASC`;
        for (let i = 0; i < remaining.length; i++) {
          await sql`UPDATE playlist_items SET position = ${i} WHERE id = ${remaining[i].id}`;
        }
      }
    } else if (action === 'reorder' && items) {
      for (const item of items) {
        await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id}`;
      }
    }

    return NextResponse.json({ success: true, playlist_id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/partner/playlists/modify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
