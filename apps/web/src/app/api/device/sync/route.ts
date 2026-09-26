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

    if (!campaign) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        campaign_status: campaign?.status || null,
        playlists: [],
        media: [],
        sync_interval_seconds: 30,
        restart: device.restart_requested || false,
      });
    }

    // 4. Verificar datas
    const now = new Date();
    const campaignStart = campaign.start_date
      ? new Date(String(campaign.start_date).length === 10 ? `${campaign.start_date}T00:00:00` : campaign.start_date)
      : null;
    const campaignEnd = campaign.end_date
      ? new Date(String(campaign.end_date).length === 10 ? `${campaign.end_date}T23:59:59.999` : campaign.end_date)
      : null;
    if (campaignStart && campaignStart > now) {
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
    if (campaignEnd && campaignEnd < now) {
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
    let slots: any = { items: [] };
    try {
      slots = await pb.collection('campaign_time_slots').getList(1, 200, {
        filter: `campaign_id = "${campaign.id}"`,
      });
    } catch {}

    const slotItems = Array.isArray(slots?.items) ? slots.items : [];
    const hasWeeklySchedule = slotItems.length > 0;

    // Calcula dia/hora atual em São Paulo
    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const jsDow = brNow.getDay();
    const pgDow = jsDow === 0 ? 6 : jsDow - 1;
    const nowTime = `${String(brNow.getHours()).padStart(2, '0')}:${String(brNow.getMinutes()).padStart(2, '0')}:${String(brNow.getSeconds()).padStart(2, '0')}`;

    let targetPlaylistIds: string[] = [];
    let matchedSlot = false;
    let nextSlotChangeSeconds = 60;

    if (hasWeeklySchedule) {
      const matchingSlot = slotItems.find((slot: any) => {
        const slotDay = Number(slot.day_of_week);
        const start = String(slot.start_time || '00:00').slice(0, 5);
        const end = String(slot.end_time || '23:59').slice(0, 5);
        const startFull = `${start}:00`;
        const endFull = `${end}:00`;
        const sameDay = slotDay === pgDow;
        const overnight = end <= start;
        return overnight
          ? sameDay && (nowTime >= startFull || nowTime < endFull)
          : sameDay && nowTime >= startFull && nowTime < endFull;
      });

      if (matchingSlot && matchingSlot.playlist_id) {
        targetPlaylistIds = [matchingSlot.playlist_id];
        matchedSlot = true;

        const endParts = (matchingSlot.end_time || '').split(':');
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        const nowMinutes = brNow.getHours() * 60 + brNow.getMinutes();
        nextSlotChangeSeconds = Math.max((endMinutes - nowMinutes) * 60, 10);
      } else {
        const upcomingSlots = slotItems
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
        } else if (slotItems.length > 0) {
          nextSlotChangeSeconds = 60;
        }
      }
    }

    // 6. Buscar campaign_playlists
    const cpList = await pb.collection('campaign_playlists').getList(1, 200, {
      filter: `campaign_id = "${campaign.id}"`,
    });

    const campaignPlaylistItems = Array.isArray(cpList?.items) ? cpList.items : [];

    if (campaignPlaylistItems.length === 0) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: campaign.id,
        campaign_status: campaign.status,
        campaign_links: campaignPlaylistItems.length,
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
      : campaignPlaylistItems.map((cp: any) => cp.playlist_id);

    for (const playlistId of resolvedPlaylistIds) {
      let playlist: any = null;
      try {
        playlist = await pb.collection('playlists').getOne(playlistId);
      } catch (e) {}

      if (!playlist) continue;

      const cpEntry = campaignPlaylistItems.find((cp: any) => cp.playlist_id === playlistId);

      const itemsList = await pb.collection('playlist_items').getList(1, 200, {
        filter: `playlist_id = "${playlist.id}"`,
        sort: 'order_index',
      });

      let slotsList: any = { items: [] };
      try {
        slotsList = await pb.collection('playlist_slots').getList(1, 200, {
          filter: `playlist_id = "${playlist.id}"`,
          sort: 'slot_index',
        });
      } catch {}

      const playlistItemRows = Array.isArray(itemsList?.items) ? itemsList.items : [];
      const slotRows = Array.isArray(slotsList?.items) ? slotsList.items : [];
      const slotsWithInfo = slotRows.map((s: any) => {
        const itemsInSlot = playlistItemRows.filter((i: any) => i.slot_id === s.id);
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
        position: cpEntry?.order_index ?? cpEntry?.position ?? 0,
        duration: cpEntry?.duration || null,
        items: playlistItemRows.map((i: any) => ({
          id: i.id,
          playlist_id: i.playlist_id,
          media_id: i.media_id,
          position: i.order_index ?? i.position ?? 0,
          order_index: i.order_index ?? i.position ?? 0,
          duration: i.duration || null,
          transition: i.transition || 'fade',
          slot_id: i.slot_id || null,
        })),
        slots: slotsWithInfo,
      });

      playlistItemRows.forEach((item: any) => {
        if (item.media_id) allMediaIds.add(item.media_id);
      });
    }

    // 7. Carregar mídias
    let mediaList: any[] = [];
    if (allMediaIds.size > 0) {
      const mediaResp = await pb.collection('media').getList(1, 200);
      mediaList = (Array.isArray(mediaResp?.items) ? mediaResp.items : []).filter((m: any) => allMediaIds.has(m.id)).map((m: any) => {
        const fileUrl = m.url || m.file_url || '';
        const ext = fileUrl.split('.').pop()?.toLowerCase() || '';
        const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
        const VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];
        let resolvedType = m.type;
        if (IMAGE_EXTS.includes(ext)) resolvedType = 'image';
        else if (VIDEO_EXTS.includes(ext)) resolvedType = 'video';
        return {
          ...m,
          file_url: fileUrl,
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
    const needsUpdate = contentVersion !== serverVersion;

    try {
      await pb.collection('device_logs').create({
        device_id: deviceId,
        organization_id: device.organization_id,
        event_type: 'sync_received',
        severity: 'info',
        message: `Sync recebido: ${allPlaylists.length} playlist(s), ${mediaList.length} mídia(s)`,
      });
    } catch {}

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
    try {
      const pb = await getAdminClient();
      await pb.collection('device_logs').create({
        device_id: new URL(request.url).searchParams.get('device_id'),
        event_type: 'sync_error',
        message: `Falha no sync: ${msg}`,
        severity: 'error',
      });
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
