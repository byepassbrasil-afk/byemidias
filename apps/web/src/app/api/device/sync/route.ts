import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const contentVersion = parseInt(searchParams.get('content_version') || '0');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();

    // 1. Buscar device
    let device: any = null;
    try {
      device = await pb.collection('devices').getOne(deviceId);
    } catch (e: any) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    // 2. Se device não tem campaign, retornar vazio
    if (!device.campaign_id) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: null,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }

    // 3. Buscar campaign
    let campaign: any = null;
    try {
      campaign = await pb.collection('campaigns').getOne(device.campaign_id);
    } catch (e) {
      campaign = null;
    }

    if (!campaign || campaign.status !== 'active') {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }

    // 4. Verificar datas
    const now = new Date();
    if (campaign.start_date && new Date(campaign.start_date) > now) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: campaign.id,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }
    if (campaign.end_date && new Date(campaign.end_date) < now) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: campaign.id,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }

    // 5. Buscar time slots e filtrar por dia/hora
    const slots = await pb.collection('campaign_time_slots').getList(1, 500, {
      filter: `campaign_id = "${campaign.id}" && status = "active"`,
    });

    const hasWeeklySchedule = slots.items.length > 0;

    // Calcula dia/hora atual em São Paulo
    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const jsDow = brNow.getDay();
    const pgDow = jsDow === 0 ? 6 : jsDow - 1;
    const nowTime = `${String(brNow.getHours()).padStart(2, '0')}:${String(brNow.getMinutes()).padStart(2, '0')}:${String(brNow.getSeconds()).padStart(2, '0')}`;

    let targetPlaylistIds: string[] = [];
    let matchedSlot = false;
    let nextSlotChangeSeconds = 60;

    if (hasWeeklySchedule) {
      const matchingSlot = slots.items.find((slot: any) => {
        const slotDay = slot.day_of_week;
        const slotStart = slot.start_time;
        const slotEnd = slot.end_time;
        return slotDay === pgDow && slotStart <= nowTime && slotEnd > nowTime;
      });

      if (matchingSlot) {
        targetPlaylistIds = [matchingSlot.playlist_id];
        matchedSlot = true;

        const endParts = (matchingSlot.end_time || '').split(':');
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        const nowMinutes = brNow.getHours() * 60 + brNow.getMinutes();
        nextSlotChangeSeconds = Math.max((endMinutes - nowMinutes) * 60, 10);
      } else {
        const upcomingSlots = slots.items
          .filter((s: any) => s.day_of_week >= pgDow)
          .sort((a: any, b: any) => {
            if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
            return (a.start_time || '').localeCompare(b.start_time || '');
          });

        if (upcomingSlots.length > 0) {
          const next = upcomingSlots[0];
          const nextDay = next.day_of_week;
          const nextStart = (next.start_time || '').split(':');
          const nextMinutes = nextDay * 24 * 60 + parseInt(nextStart[0]) * 60 + parseInt(nextStart[1]);
          const nowMinutes = pgDow * 24 * 60 + brNow.getHours() * 60 + brNow.getMinutes();
          nextSlotChangeSeconds = Math.max((nextMinutes - nowMinutes) * 60, 10);
        } else if (slots.items.length > 0) {
          nextSlotChangeSeconds = 60;
        }
      }
    }

    // 6. Buscar campaign_playlists
    const cpList = await pb.collection('campaign_playlists').getList(1, 500, {
      filter: `campaign_id = "${campaign.id}"`,
      sort: 'order_index',
    });

    if (cpList.items.length === 0) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: campaign.id,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }

    const allPlaylists: any[] = [];
    const allMediaIds = new Set<string>();

    const resolvedPlaylistIds = targetPlaylistIds.length > 0
      ? targetPlaylistIds
      : cpList.items.map((cp: any) => cp.playlist_id);

    for (const playlistId of resolvedPlaylistIds) {
      let playlist: any = null;
      try {
        playlist = await pb.collection('playlists').getOne(playlistId);
      } catch (e) {}

      if (!playlist) continue;

      const cpEntry = cpList.items.find((cp: any) => cp.playlist_id === playlistId);

      const itemsList = await pb.collection('playlist_items').getList(1, 500, {
        filter: `playlist_id = "${playlist.id}"`,
        sort: 'order_index',
      });

      const slotsList = await pb.collection('playlist_slots').getList(1, 500, {
        filter: `playlist_id = "${playlist.id}"`,
        sort: 'slot_index',
      });

      const slotsWithInfo = slotsList.items.map((s: any) => {
        const itemsInSlot = itemsList.items.filter((i: any) => i.slot_id === s.id);
        return {
          id: s.id,
          slot_order: s.slot_index,
          duration_seconds: s.duration || null,
          partner_access_id: s.partner_access_id || null,
          content_duration: itemsInSlot.reduce((acc: number, i: any) => acc + (i.duration || 0), 0),
          item_count: itemsInSlot.length,
          has_content: itemsInSlot.length > 0,
          type: 'slot',
        };
      });

      allPlaylists.push({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        position: cpEntry?.order_index ?? 0,
        duration: cpEntry?.duration || null,
        items: itemsList.items.map((i: any) => ({
          id: i.id,
          playlist_id: i.playlist_id,
          media_id: i.media_id,
          order_index: i.order_index,
          duration: i.duration || null,
          transition: i.transition || 'fade',
          slot_id: i.slot_id || null,
        })),
        slots: slotsWithInfo,
      });

      itemsList.items.forEach((item: any) => {
        if (item.media_id) allMediaIds.add(item.media_id);
      });
    }

    // 7. Carregar mídias
    let mediaList: any[] = [];
    if (allMediaIds.size > 0) {
      const mediaIdsArray = Array.from(allMediaIds);
      const mediaResp = await pb.collection('media').getList(1, 500, {
        filter: `id = "${mediaIdsArray.join('" || id = "')}"`,
      });
      mediaList = mediaResp.items.map((m: any) => {
        const fileUrl = m.url || '';
        const ext = fileUrl.split('.').pop()?.toLowerCase() || '';
        const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
        const VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];
        let resolvedType = m.type;
        if (IMAGE_EXTS.includes(ext)) resolvedType = 'image';
        else if (VIDEO_EXTS.includes(ext)) resolvedType = 'video';
        return {
          ...m,
          resolved_type: resolvedType,
          display_name: m.display_name || m.name,
          default_orientation: m.default_orientation || 'auto',
        };
      });
    }

    // 8. Limpar restart_requested se setado
    const shouldRestart = device.restart_requested || false;
    if (shouldRestart) {
      try {
        await pb.collection('devices').update(deviceId, { restart_requested: false });
      } catch (e) {}
    }

    // 9. Reset screenshot_requested
    let screenshotRequested = device.screenshot_requested || false;
    if (screenshotRequested) {
      try {
        await pb.collection('devices').update(deviceId, { screenshot_requested: false });
      } catch (e) {}
    }

    const serverVersion = device.content_version || 0;
    const needsUpdate = contentVersion < serverVersion && contentVersion > 0;

    return NextResponse.json({
      content_version: serverVersion,
      needs_update: needsUpdate,
      campaign_id: campaign.id,
      matched_slot: matchedSlot,
      sync_interval_seconds: matchedSlot ? Math.min(nextSlotChangeSeconds, 60) : 30,
      screenshot_requested: screenshotRequested,
      restart: shouldRestart,
      layout_template_id: device.layout_template_id || null,
      layout_zones: [],
      playlists: allPlaylists,
      media: mediaList,
      device_orientation: device.orientation || 'landscape',
      screen_rotation: device.screen_rotation || 0,
      mirror_horizontal: device.mirror_horizontal || false,
      mirror_vertical: device.mirror_vertical || false,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[sync]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
