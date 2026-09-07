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

    const [device] = await sql`SELECT id, organization_id, content_version, campaign_id, restart_requested, category_overrides, screen_rotation, mirror_horizontal, mirror_vertical, orientation FROM devices WHERE id = ${deviceId}`;
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
    let blockedMediaLog: Array<{ media_id: string; media_name: string; reason: string; category_ids: string[] }> = [];
    if (allMediaIds.size > 0) {
      // ====== FILTRO DE CATEGORIAS (server-side) ======
      // Pega overrides do device
      let overridesRaw = device.category_overrides ?? {};
      // postgres.js pode retornar JSONB como string ou objeto dependendo da versão
      let overrides: Record<string, any> = {};
      if (typeof overridesRaw === 'string') {
        try {
          overrides = JSON.parse(overridesRaw);
        } catch {
          overrides = {};
        }
      } else if (typeof overridesRaw === 'object') {
        overrides = { ...overridesRaw };
      }

      // Busca categorias do device (com flag is_blocked)
      const deviceCategories = await sql`
        SELECT category_id, is_blocked FROM device_categories WHERE device_id = ${deviceId}
      `;

      // Determina IDs bloqueados pela categoria OU por override
      const blockedIds = new Set<string>();
      const forcedIds = new Set<string>();

      for (const [mediaId, ov] of Object.entries(overrides)) {
        if (ov.force_show === true) forcedIds.add(mediaId);
        if (ov.force_show === false) blockedIds.add(mediaId);
      }

      // Para cada mídia da playlist, verificar se passa no filtro
      const allowedMediaIds = new Set<string>();
      const blockedByCategoryIds = new Set<string>();
      const blockedByCategoryIdsPerMedia = new Map<string, string[]>();
      const mediaIdsArray = Array.from(allMediaIds);

      // Mídias enviadas por parceiros são LIBERADAS de bloqueio de categoria:
      // parceiro é o único que pode subir mídia para a categoria dele,
      // portanto as regras de bloqueio de categoria da org não se aplicam a ele.
      const partnerMediaRows = await sql`
        SELECT DISTINCT media_id FROM partner_media_uploads
        WHERE media_id = ANY(${mediaIdsArray})
      `;
      const partnerMediaIds = new Set(partnerMediaRows.map((r: any) => r.media_id));

      if (deviceCategories.length === 0) {
        // Modo permissivo: device sem categorias configuradas
        for (const mid of mediaIdsArray) allowedMediaIds.add(mid);
      } else {
        // Verifica cada mídia contra categorias bloqueadas
        const mediaCats = await sql`
          SELECT media_id, category_id FROM media_categories
          WHERE media_id = ANY(${mediaIdsArray})
        `;
        const blockedCats = new Set(
          deviceCategories.filter((dc: any) => dc.is_blocked).map((dc: any) => dc.category_id)
        );
        const mediaToBlockedCats = new Map<string, Set<string>>();
        for (const mc of mediaCats) {
          if (!mediaToBlockedCats.has(mc.media_id)) mediaToBlockedCats.set(mc.media_id, new Set());
          mediaToBlockedCats.get(mc.media_id)!.add(mc.category_id);
        }
        for (const mid of mediaIdsArray) {
          // Parceiro ignora filtro de categoria
          if (partnerMediaIds.has(mid)) {
            allowedMediaIds.add(mid);
            continue;
          }
          const cats = mediaToBlockedCats.get(mid) || new Set();
          const blockedHere = Array.from(cats).filter(c => blockedCats.has(c));
          if (blockedHere.length > 0) {
            blockedByCategoryIds.add(mid);
            // Track which categories blocked this media
            blockedByCategoryIdsPerMedia.set(mid, blockedHere);
          } else {
            allowedMediaIds.add(mid);
          }
        }
      }

      // Aplica overrides finais
      const finalIds = mediaIdsArray.filter(mid => {
        if (blockedIds.has(mid) && !forcedIds.has(mid)) return false; // bloqueado por override
        if (forcedIds.has(mid)) return true; // forçado por override
        return allowedMediaIds.has(mid); // passa pelo filtro normal
      });

      // ─── Media-side exclusion (mídia declara onde NÃO deve aparecer) ───
      // Cada mídia pode ter:
      //   excluded_organization_ids → bloqueia em orgs específicas
      //   excluded_category_ids    → bloqueia em devices cuja org tem a categoria
      //   excluded_device_ids      → bloqueia em devices específicos
      // Isso é independente do filtro device-side acima.
      const deviceOrgId = device.organization_id as string;
      const deviceIdStr = (device.id as string);
      let deviceOrgCategoryId: string | null = null;
      if (finalIds.length > 0) {
        const [devOrg] = await sql`SELECT category_id FROM organizations WHERE id = ${deviceOrgId}`;
        deviceOrgCategoryId = (devOrg?.category_id as string | null) || null;
      }
      const finalIdsAfterMediaExclusion: string[] = [];
      const mediaExclusionLog: Array<{ media_id: string; media_name: string; reason: string }> = [];
      if (finalIds.length > 0) {
        const excludedRows = await sql`
          SELECT id, name, excluded_organization_ids, excluded_category_ids, excluded_device_ids
          FROM media WHERE id = ANY(${finalIds})
        `;
        const excludedMap = new Map<string, { name: string; exOrgs: string[]; exCats: string[]; exDevs: string[] }>();
        for (const row of excludedRows as Array<Record<string, unknown>>) {
          excludedMap.set(row.id as string, {
            name: (row.name as string) || 'unknown',
            exOrgs: (row.excluded_organization_ids as string[] | null) || [],
            exCats: (row.excluded_category_ids as string[] | null) || [],
            exDevs: (row.excluded_device_ids as string[] | null) || [],
          });
        }
        for (const mid of finalIds) {
          const info = excludedMap.get(mid);
          if (!info) { finalIdsAfterMediaExclusion.push(mid); continue; }
          if (info.exDevs.length > 0 && info.exDevs.includes(deviceIdStr)) {
            mediaExclusionLog.push({ media_id: mid, media_name: info.name, reason: 'media_excluded_device' });
            continue;
          }
          if (info.exOrgs.length > 0 && info.exOrgs.includes(deviceOrgId)) {
            mediaExclusionLog.push({ media_id: mid, media_name: info.name, reason: 'media_excluded_org' });
            continue;
          }
          if (info.exCats.length > 0 && deviceOrgCategoryId && info.exCats.includes(deviceOrgCategoryId)) {
            mediaExclusionLog.push({ media_id: mid, media_name: info.name, reason: 'media_excluded_category' });
            continue;
          }
          finalIdsAfterMediaExclusion.push(mid);
        }
      } else {
        // finalIds is empty
      }

      // Coleta info de mídias bloqueadas para log (rate limited)
      const finalBlockedIds = new Set(mediaIdsArray.filter(mid => !finalIdsAfterMediaExclusion.includes(mid) || (blockedIds.has(mid) && !forcedIds.has(mid))));
      if (finalBlockedIds.size > 0 && finalBlockedIds.size <= 50) {
        const blockedMediaInfo = await sql`
          SELECT id, name FROM media WHERE id = ANY(${Array.from(finalBlockedIds)})
        `;
        const mediaNameMap = new Map(blockedMediaInfo.map((m: any) => [m.id, m.name]));
        for (const mid of finalBlockedIds) {
          const reason = blockedIds.has(mid) && !forcedIds.has(mid)
            ? 'manual_override_blocked'
            : blockedByCategoryIds.has(mid)
            ? 'category_blocked'
            : 'unknown';
          const categoryIds = blockedByCategoryIdsPerMedia.get(mid) || [];
          blockedMediaLog.push({
            media_id: mid,
            media_name: mediaNameMap.get(mid) || 'unknown',
            reason,
            category_ids: categoryIds,
          });
        }
      }

      if (finalIdsAfterMediaExclusion.length > 0) {
        const rawMedia: Array<Record<string, unknown>> = await sql`SELECT * FROM media WHERE id = ANY(${finalIdsAfterMediaExclusion})`;
        const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
        const VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];
        mediaList = rawMedia.map(m => {
          const fileUrl = (m.file_url as string) || '';
          const ext = fileUrl.split('.').pop()?.toLowerCase() || '';
          let resolvedType = m.type as string;
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
    }

    // Log de mídias bloqueadas (rate limited: só loga se houve mudança no sync)
    if (blockedMediaLog.length > 0) {
      try {
        // Verifica se já logou essas mídias bloqueadas nos últimos 10 minutos para não duplicar
        const recentLogs = await sql`
          SELECT message FROM device_logs
          WHERE device_id = ${deviceId}
            AND event_type = 'media_blocked'
            AND created_at > NOW() - INTERVAL '10 minutes'
        `;
        const loggedMessages = new Set(recentLogs.map((r: any) => r.message));

        for (const blocked of blockedMediaLog) {
          const logMsg = `Mídia bloqueada: ${blocked.media_name} (${blocked.reason})`;
          if (loggedMessages.has(logMsg)) continue;
          await sql`
            INSERT INTO device_logs (device_id, event_type, severity, message)
            VALUES (${deviceId}, 'media_blocked', 'info', ${logMsg})
          `;

          // Insert into category_history
          if (blocked.category_ids && blocked.category_ids.length > 0) {
            for (const catId of blocked.category_ids) {
              await sql`
                INSERT INTO category_history (device_id, media_id, category_id, action, reason)
                VALUES (${deviceId}, ${blocked.media_id}, ${catId}, 'blocked', ${blocked.reason})
              `;
            }
          } else if (blocked.reason === 'manual_override_blocked') {
            await sql`
              INSERT INTO category_history (device_id, media_id, category_id, action, reason)
              VALUES (${deviceId}, ${blocked.media_id}, NULL, 'override_blocked', ${blocked.reason})
            `;
          }
        }
      } catch (logErr) {
        // Não falhar o sync se o log falhar
        console.error('Failed to log blocked media:', logErr);
      }
    }

    // Only return current version — DON'T increment on every call
    // Increment content_version only when actual content changes (playlist/media/campaign edits)
    const serverVersion = device.content_version || 0;
    const needsUpdate = contentVersion < serverVersion && contentVersion > 0;

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
      // Device-level settings (orientation, rotation, mirror)
      device_orientation: device.orientation || 'landscape',
      screen_rotation: device.screen_rotation || 0,
      mirror_horizontal: device.mirror_horizontal || false,
      mirror_vertical: device.mirror_vertical || false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
