import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/partner/playlists/modify - Create a pending version of a playlist
export async function POST(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { playlist_id, action, media_id, items, slot_id } = await request.json();

  if (!playlist_id || !action) {
    return NextResponse.json({ error: 'playlist_id e action obrigatórios' }, { status: 400 });
  }

  // Verify partner has access to this playlist (via device or slot)
  let hasAccess = false;

  // Check via device
  const { data: partnerDevice } = await supabase
    .from('partner_devices')
    .select('playlist_id')
    .eq('partner_access_id', session.partnerAccessId)
    .eq('playlist_id', playlist_id)
    .single();

  if (partnerDevice) {
    hasAccess = true;
  }

  // Check via slot
  if (slot_id) {
    const { data: slot } = await supabase
      .from('playlist_slots')
      .select('id')
      .eq('id', slot_id)
      .eq('partner_access_id', session.partnerAccessId)
      .eq('playlist_id', playlist_id)
      .single();

    if (slot) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Sem acesso a esta playlist' }, { status: 403 });
  }

  // Get the current approved version
  const { data: originalPlaylist } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlist_id)
    .eq('approval_status', 'approved')
    .single();

  if (!originalPlaylist) {
    return NextResponse.json({ error: 'Playlist não encontrada ou não aprovada' }, { status: 404 });
  }

  // Check if there's already a pending version for this playlist
  const { data: existingPending } = await supabase
    .from('playlists')
    .select('id')
    .eq('parent_id', playlist_id)
    .eq('approval_status', 'pending')
    .single();

  let targetPlaylistId = playlist_id;
  let targetVersion = originalPlaylist.version;

  if (existingPending) {
    // Update existing pending version
    targetPlaylistId = existingPending.id;
    targetVersion = originalPlaylist.version + 1;
  } else {
    // Create new pending version
    const { data: newPlaylist, error: createError } = await supabase
      .from('playlists')
      .insert({
        organization_id: originalPlaylist.organization_id,
        name: originalPlaylist.name,
        description: originalPlaylist.description,
        version: originalPlaylist.version + 1,
        approval_status: 'pending',
        parent_id: playlist_id,
        requested_by: session.username,
        requested_at: new Date().toISOString(),
        status: 'active',
      })
      .select('id')
      .single();

    if (createError || !newPlaylist) {
      return NextResponse.json({ error: 'Erro ao criar versão: ' + (createError?.message || 'unknown') }, { status: 500 });
    }

    targetPlaylistId = newPlaylist.id;
    targetVersion = originalPlaylist.version + 1;

    // Copy all items from original to new version
    const { data: originalItems } = await supabase
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlist_id);

    if (originalItems && originalItems.length > 0) {
      // Copy slots too
      const { data: originalSlots } = await supabase
        .from('playlist_slots')
        .select('*')
        .eq('playlist_id', playlist_id);

      const slotIdMap: Record<string, string> = {};

      if (originalSlots && originalSlots.length > 0) {
        for (const slot of originalSlots) {
          const { data: newSlot } = await supabase
            .from('playlist_slots')
            .insert({
              playlist_id: targetPlaylistId,
              partner_access_id: slot.partner_access_id,
              slot_order: slot.slot_order,
              duration_seconds: slot.duration_seconds,
            })
            .select('id')
            .single();

          if (newSlot) {
            slotIdMap[slot.id] = newSlot.id;
          }
        }
      }

      const newItems = originalItems.map((item) => ({
        playlist_id: targetPlaylistId,
        media_id: item.media_id,
        position: item.position,
        duration: item.duration,
        transition: item.transition,
        slot_id: item.slot_id ? (slotIdMap[item.slot_id] || null) : null,
      }));

      await supabase.from('playlist_items').insert(newItems);
    }
  }

  // Apply the action to the target version
  if (action === 'add' && media_id) {
    // Get max position in the target slot or playlist
    let query = supabase
      .from('playlist_items')
      .select('position')
      .eq('playlist_id', targetPlaylistId);

    if (slot_id) {
      // Find the slot in the new version
      const { data: newSlot } = await supabase
        .from('playlist_slots')
        .select('id')
        .eq('playlist_id', targetPlaylistId)
        .eq('slot_order', (await supabase.from('playlist_slots').select('slot_order').eq('id', slot_id).single()).data?.slot_order ?? 0)
        .single();

      if (newSlot) {
        query = query.eq('slot_id', newSlot.id);
      }
    }

    const { data: existingItems } = await query.order('position', { ascending: false }).limit(1);

    const maxPos = existingItems?.[0]?.position ?? -1;

    await supabase.from('playlist_items').insert({
      playlist_id: targetPlaylistId,
      media_id,
      position: maxPos + 1,
      duration: 10,
      transition: 'fade',
      slot_id: slot_id || null,
    });
  } else if (action === 'remove' && media_id) {
    // Remove item from the target playlist
    const { data: itemToRemove } = await supabase
      .from('playlist_items')
      .select('id')
      .eq('playlist_id', targetPlaylistId)
      .eq('media_id', media_id)
      .single();

    if (itemToRemove) {
      await supabase.from('playlist_items').delete().eq('id', itemToRemove.id);
      // Reindex positions
      const { data: remaining } = await supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', targetPlaylistId)
        .order('position', { ascending: true });

      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase.from('playlist_items').update({ position: i }).eq('id', remaining[i].id);
        }
      }
    }
  } else if (action === 'reorder' && items) {
    // Reorder items in the target playlist
    for (const item of items) {
      await supabase.from('playlist_items').update({ position: item.position }).eq('id', item.id);
    }
  }

  return NextResponse.json({
    success: true,
    version: targetVersion,
    playlist_id: targetPlaylistId,
    approval_status: 'pending',
  });
}
