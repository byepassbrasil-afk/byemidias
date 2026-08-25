import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function POST(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { playlist_id, action, media_id, items, slot_id } = await request.json();

  if (!playlist_id || !action) {
    return NextResponse.json({ error: 'playlist_id e action obrigatórios' }, { status: 400 });
  }

  let hasAccess = false;

  const [partnerDevice] = await sql`SELECT playlist_id FROM partner_devices WHERE partner_access_id = ${session.partnerAccessId} AND playlist_id = ${playlist_id}`;

  if (partnerDevice) {
    hasAccess = true;
  }

  if (slot_id) {
    const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slot_id} AND partner_access_id = ${session.partnerAccessId} AND playlist_id = ${playlist_id}`;

    if (slot) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Sem acesso a esta playlist' }, { status: 403 });
  }

  const [originalPlaylist] = await sql`SELECT * FROM playlists WHERE id = ${playlist_id} AND approval_status = 'approved'`;

  if (!originalPlaylist) {
    return NextResponse.json({ error: 'Playlist não encontrada ou não aprovada' }, { status: 404 });
  }

  const [existingPending] = await sql`SELECT id FROM playlists WHERE parent_id = ${playlist_id} AND approval_status = 'pending'`;

  let targetPlaylistId = playlist_id;
  let targetVersion = originalPlaylist.version;

  if (existingPending) {
    targetPlaylistId = existingPending.id;
    targetVersion = originalPlaylist.version + 1;
  } else {
    const [newPlaylist] = await sql`
      INSERT INTO playlists (organization_id, name, description, version, approval_status, parent_id, requested_by, requested_at, status)
      VALUES (${originalPlaylist.organization_id}, ${originalPlaylist.name}, ${originalPlaylist.description}, ${originalPlaylist.version + 1}, 'pending', ${playlist_id}, ${session.username}, ${new Date().toISOString()}, 'active')
      RETURNING id
    `;

    if (!newPlaylist) {
      return NextResponse.json({ error: 'Erro ao criar versão' }, { status: 500 });
    }

    targetPlaylistId = newPlaylist.id;
    targetVersion = originalPlaylist.version + 1;

    const originalItems = await sql`SELECT * FROM playlist_items WHERE playlist_id = ${playlist_id}`;

    if (originalItems && originalItems.length > 0) {
      const originalSlots = await sql`SELECT * FROM playlist_slots WHERE playlist_id = ${playlist_id}`;

      const slotIdMap: Record<string, string> = {};

      if (originalSlots && originalSlots.length > 0) {
        for (const slot of originalSlots) {
          const [newSlot] = await sql`
            INSERT INTO playlist_slots (playlist_id, partner_access_id, slot_order, duration_seconds)
            VALUES (${targetPlaylistId}, ${slot.partner_access_id}, ${slot.slot_order}, ${slot.duration_seconds})
            RETURNING id
          `;

          if (newSlot) {
            slotIdMap[slot.id] = newSlot.id;
          }
        }
      }

      for (const item of originalItems) {
        await sql`
          INSERT INTO playlist_items (playlist_id, media_id, position, duration, transition, slot_id)
          VALUES (${targetPlaylistId}, ${item.media_id}, ${item.position}, ${item.duration}, ${item.transition}, ${item.slot_id ? (slotIdMap[item.slot_id] || null) : null})
        `;
      }
    }
  }

  if (action === 'add' && media_id) {
    let maxPosQuery;
    if (slot_id) {
      const [origSlot] = await sql`SELECT slot_order FROM playlist_slots WHERE id = ${slot_id}`;
      const [newSlot] = await sql`SELECT id FROM playlist_slots WHERE playlist_id = ${targetPlaylistId} AND slot_order = ${origSlot?.slot_order ?? 0}`;
      if (newSlot) {
        maxPosQuery = await sql`SELECT position FROM playlist_items WHERE playlist_id = ${targetPlaylistId} AND slot_id = ${newSlot.id} ORDER BY position DESC LIMIT 1`;
      }
    }

    if (!maxPosQuery || maxPosQuery.length === 0) {
      maxPosQuery = await sql`SELECT position FROM playlist_items WHERE playlist_id = ${targetPlaylistId} ORDER BY position DESC LIMIT 1`;
    }

    const maxPos = maxPosQuery?.[0]?.position ?? -1;

    await sql`
      INSERT INTO playlist_items (playlist_id, media_id, position, duration, transition, slot_id)
      VALUES (${targetPlaylistId}, ${media_id}, ${maxPos + 1}, 10, 'fade', ${slot_id || null})
    `;
  } else if (action === 'remove' && media_id) {
    const [itemToRemove] = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${targetPlaylistId} AND media_id = ${media_id}`;

    if (itemToRemove) {
      await sql`DELETE FROM playlist_items WHERE id = ${itemToRemove.id}`;

      const remaining = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${targetPlaylistId} ORDER BY position ASC`;

      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          await sql`UPDATE playlist_items SET position = ${i} WHERE id = ${remaining[i].id}`;
        }
      }
    }
  } else if (action === 'reorder' && items) {
    for (const item of items) {
      await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id}`;
    }
  }

  return NextResponse.json({
    success: true,
    version: targetVersion,
    playlist_id: targetPlaylistId,
    approval_status: 'pending',
  });
}
