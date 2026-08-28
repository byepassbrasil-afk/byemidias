import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const contentVersion = parseInt(searchParams.get('content_version') || '0');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    const [device] = await sql`SELECT id, organization_id, content_version, campaign_id, restart_requested FROM devices WHERE id = ${deviceId}`;
    if (!device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    if (!device.campaign_id) {
      const shouldRestart = device.restart_requested || false;
      if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: null, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
    }

    const [campaign] = await sql`SELECT id, name, priority, status, start_date, end_date, start_time, end_time, days_of_week FROM campaigns WHERE id = ${device.campaign_id}`;
    if (!campaign || campaign.status !== 'active') {
      const shouldRestart = device.restart_requested || false;
      if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
    }

    const now = new Date();
    if (campaign.start_date && now < new Date(campaign.start_date)) {
      const shouldRestart = device.restart_requested || false;
      if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
    }
    if (campaign.end_date && now > new Date(campaign.end_date)) {
      const shouldRestart = device.restart_requested || false;
      if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
    }

    const targets = await sql`SELECT target_type, target_id FROM campaign_targets WHERE campaign_id = ${campaign.id}`;
    if (targets.length > 0 && !device.campaign_id) {
      const [deviceUnit] = await sql`SELECT unit_id FROM devices WHERE id = ${deviceId}`;
      const isTargeted = targets.some((t: Record<string, unknown>) =>
        (t.target_type === 'device' && t.target_id === deviceId) ||
        (t.target_type === 'unit' && deviceUnit?.unit_id && t.target_id === deviceUnit.unit_id)
      );
      if (!isTargeted) {
        const shouldRestart = device.restart_requested || false;
        if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
        return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
      }
    }

    try { await sql`SELECT deactivate_expired_campaigns()`; } catch (_) {}

    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const jsDow = brNow.getDay();
    const pgDow = jsDow === 0 ? 6 : jsDow - 1;
    const nowTime = `${String(brNow.getHours()).padStart(2, '0')}:${String(brNow.getMinutes()).padStart(2, '0')}:${String(brNow.getSeconds()).padStart(2, '0')}`;

    const allTimeSlots = await sql`SELECT playlist_id, day_of_week, start_time, end_time, priority FROM campaign_time_slots WHERE campaign_id = ${campaign.id} AND status = 'active' ORDER BY priority DESC`;
    const hasWeeklySchedule = allTimeSlots.length > 0;

    let targetPlaylistIds: string[] = [];
    let matchedSlot = false;
    let nextSlotChangeSeconds = 60;

    if (hasWeeklySchedule) {
      const matchingSlot = allTimeSlots.find((slot: Record<string, unknown>) => {
        const slotDay = slot.day_of_week as number;
        const slotStart = slot.start_time as string;
        const slotEnd = slot.end_time as string;
        return slotDay === pgDow && slotStart <= nowTime && slotEnd > nowTime;
      });

      if (matchingSlot) {
        targetPlaylistIds = [matchingSlot.playlist_id as string];
        matchedSlot = true;

        const endParts = (matchingSlot.end_time as string).split(':');
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        const nowMinutes = brNow.getHours() * 60 + brNow.getMinutes();
        nextSlotChangeSeconds = Math.max((endMinutes - nowMinutes) * 60, 10);
      } else {
        const upcomingSlots = allTimeSlots
          .filter((slot: Record<string, unknown>) => (slot.day_of_week as number) >= pgDow)
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const dayDiff = (a.day_of_week as number) - (b.day_of_week as number);
            if (dayDiff !== 0) return dayDiff;
            return (a.start_time as string).localeCompare(b.start_time as string);
          });

        if (upcomingSlots.length > 0) {
          const next = upcomingSlots[0];
          const nextDay = next.day_of_week as number;
          const nextStart = (next.start_time as string).split(':');
          const nextMinutes = nextDay * 24 * 60 + parseInt(nextStart[0]) * 60 + parseInt(nextStart[1]);
          const nowMinutes = pgDow * 24 * 60 + brNow.getHours() * 60 + brNow.getMinutes();
          nextSlotChangeSeconds = Math.max((nextMinutes - nowMinutes) * 60, 10);
        } else if (allTimeSlots.length > 0) {
          nextSlotChangeSeconds = 60;
        }
      }
    }

    const campaignPlaylists = await sql`SELECT playlist_id, position, duration FROM campaign_playlists WHERE campaign_id = ${campaign.id} ORDER BY position ASC`;
    if (campaignPlaylists.length === 0) {
      const shouldRestart = device.restart_requested || false;
      if (shouldRestart) await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [], sync_interval_seconds: 30, restart: shouldRestart });
    }

    const allPlaylists: Array<Record<string, unknown>> = [];
    const allMediaIds = new Set<string>();

    const resolvedPlaylistIds = targetPlaylistIds.length > 0
      ? targetPlaylistIds
      : campaignPlaylists.map((cp: Record<string, unknown>) => cp.playlist_id as string);

    for (const playlistId of resolvedPlaylistIds) {
      const [pl] = await sql`SELECT id, name, description FROM playlists WHERE id = ${playlistId}`;
      if (!pl) continue;

      const cpEntry = campaignPlaylists.find((cp: Record<string, unknown>) => cp.playlist_id === playlistId);
      const items = await sql`SELECT * FROM playlist_items WHERE playlist_id = ${pl.id} ORDER BY position ASC`;

      // Load slots for this playlist with content info
      const slots = await sql`
        SELECT ps.id, ps.slot_order, ps.duration_seconds, ps.partner_access_id,
               pa.display_name as partner_name, pa.username as partner_username,
               COALESCE(
                 (SELECT SUM(pi.duration) FROM playlist_items pi WHERE pi.slot_id = ps.id),
                 0
               ) as content_duration,
               (SELECT COUNT(*)::int FROM playlist_items pi WHERE pi.slot_id = ps.id) as item_count
        FROM playlist_slots ps
        LEFT JOIN partner_access pa ON pa.id = ps.partner_access_id
        WHERE ps.playlist_id = ${pl.id}
        ORDER BY ps.slot_order ASC
      `;

      // Build slots array with has_content flag
      const slotsWithInfo = slots.map((s: Record<string, unknown>) => ({
        id: s.id,
        slot_order: s.slot_order,
        duration_seconds: s.duration_seconds,
        partner_access_id: s.partner_access_id,
        partner_name: s.partner_name,
        partner_username: s.partner_username,
        content_duration: s.content_duration || 0,
        has_content: (s.item_count as number) > 0,
        type: 'slot',
      }));

      allPlaylists.push({
        id: pl.id,
        name: pl.name,
        description: pl.description,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        position: cpEntry?.position ?? 0,
        duration: cpEntry?.duration ?? null,
        items,
        slots: slotsWithInfo,
      });

      items.forEach((item: Record<string, unknown>) => {
        if (item.media_id) allMediaIds.add(item.media_id as string);
      });
    }

    let mediaList: Record<string, unknown>[] = [];
    if (allMediaIds.size > 0) {
      mediaList = await sql`SELECT * FROM media WHERE id = ANY(${Array.from(allMediaIds)})`;
    }

    const serverVersion = (device.content_version || 0) + 1;
    const needsUpdate = serverVersion > contentVersion;

    if (allPlaylists.length > 0) {
      await sql`UPDATE devices SET content_version = ${serverVersion}, updated_at = NOW() WHERE id = ${deviceId}`;
    }

    const [deviceFull] = await sql`SELECT layout_template_id, screenshot_requested FROM devices WHERE id = ${deviceId}`;
    let layoutZones: unknown[] = [];
    if (deviceFull?.layout_template_id) {
      const [layout] = await sql`SELECT zones FROM layout_templates WHERE id = ${deviceFull.layout_template_id}`;
      if (layout?.zones) {
        layoutZones = typeof layout.zones === 'string' ? JSON.parse(layout.zones) : layout.zones as unknown[];
      }
    }

    const screenshotRequested = deviceFull?.screenshot_requested || false;
    if (screenshotRequested) {
      await sql`UPDATE devices SET screenshot_requested = FALSE WHERE id = ${deviceId}`;
    }

    const shouldRestart = device.restart_requested || false;
    if (shouldRestart) {
      await sql`UPDATE devices SET restart_requested = FALSE WHERE id = ${deviceId}`;
    }

    return NextResponse.json({
      content_version: serverVersion,
      needs_update: needsUpdate,
      campaign_id: campaign.id,
      matched_slot: matchedSlot,
      sync_interval_seconds: matchedSlot ? Math.min(nextSlotChangeSeconds, 60) : 30,
      screenshot_requested: screenshotRequested,
      restart: shouldRestart,
      layout_template_id: deviceFull?.layout_template_id || null,
      layout_zones: layoutZones,
      playlists: allPlaylists,
      media: mediaList,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
