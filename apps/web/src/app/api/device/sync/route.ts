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

    const [device] = await sql`SELECT id, organization_id, content_version, campaign_id FROM devices WHERE id = ${deviceId}`;
    if (!device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    // Device MUST have campaign_id
    if (!device.campaign_id) {
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: null, playlists: [], media: [] });
    }

    // Fetch campaign
    const [campaign] = await sql`SELECT id, name, priority, status, start_date, end_date, start_time, end_time, days_of_week FROM campaigns WHERE id = ${device.campaign_id}`;
    if (!campaign || campaign.status !== 'active') {
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [] });
    }

    // Check date constraints
    const now = new Date();
    if (campaign.start_date && now < new Date(campaign.start_date)) {
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [] });
    }
    if (campaign.end_date && now > new Date(campaign.end_date)) {
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [] });
    }

    // Check campaign_targets (skip if device has direct campaign_id)
    const targets = await sql`SELECT target_type, target_id FROM campaign_targets WHERE campaign_id = ${campaign.id}`;
    if (targets.length > 0 && !device.campaign_id) {
      const [deviceUnit] = await sql`SELECT unit_id FROM devices WHERE id = ${deviceId}`;
      const isTargeted = targets.some((t: Record<string, unknown>) =>
        (t.target_type === 'device' && t.target_id === deviceId) ||
        (t.target_type === 'unit' && deviceUnit?.unit_id && t.target_id === deviceUnit.unit_id)
      );
      if (!isTargeted) {
        return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [] });
      }
    }

    // Auto-deactivate expired campaigns
    try { await sql`SELECT deactivate_expired_campaigns()`; } catch (_) {}

    // Check time slots
    const jsDow = now.getDay();
    const pgDow = jsDow === 0 ? 6 : jsDow - 1;
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const [matchingSlot] = await sql`SELECT playlist_id FROM campaign_time_slots WHERE campaign_id = ${campaign.id} AND day_of_week = ${pgDow} AND start_time <= ${nowTime} AND end_time > ${nowTime} AND status = 'active' ORDER BY priority DESC LIMIT 1`;

    // Get campaign playlists
    const campaignPlaylists = await sql`SELECT playlist_id, position, duration FROM campaign_playlists WHERE campaign_id = ${campaign.id} ORDER BY position ASC`;
    if (campaignPlaylists.length === 0) {
      return NextResponse.json({ content_version: device.content_version || 0, needs_update: false, campaign_id: device.campaign_id, playlists: [], media: [] });
    }

    // Determine which playlists to return
    const targetPlaylistIds: string[] = matchingSlot?.playlist_id
      ? [matchingSlot.playlist_id]
      : campaignPlaylists.map((cp: Record<string, unknown>) => cp.playlist_id as string);

    const allPlaylists: Array<Record<string, unknown>> = [];
    const allMediaIds = new Set<string>();

    for (const cp of campaignPlaylists) {
      if (!targetPlaylistIds.includes(cp.playlist_id)) continue;

      const [pl] = await sql`SELECT id, name, description FROM playlists WHERE id = ${cp.playlist_id}`;
      if (!pl) continue;

      const items = await sql`SELECT * FROM playlist_items WHERE playlist_id = ${pl.id} ORDER BY position ASC`;

      allPlaylists.push({
        id: pl.id,
        name: pl.name,
        description: pl.description,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        position: cp.position,
        duration: cp.duration,
        items,
      });

      items.forEach((item: Record<string, unknown>) => {
        if (item.media_id) allMediaIds.add(item.media_id as string);
      });
    }

    // Fetch all media
    let mediaList: Record<string, unknown>[] = [];
    if (allMediaIds.size > 0) {
      mediaList = await sql`SELECT * FROM media WHERE id = ANY(${Array.from(allMediaIds)})`;
    }

    let serverVersion = device.content_version || 0;
    if (serverVersion === 0 && allPlaylists.length > 0) serverVersion = 1;
    const needsUpdate = serverVersion > contentVersion;

    // Update device content_version if needed
    if (allPlaylists.length > 0 && serverVersion > (device.content_version || 0)) {
      await sql`UPDATE devices SET content_version = ${serverVersion}, updated_at = NOW() WHERE id = ${deviceId}`;
    }

    // Get layout zones
    const [deviceFull] = await sql`SELECT layout_template_id FROM devices WHERE id = ${deviceId}`;
    let layoutZones: unknown[] = [];
    if (deviceFull?.layout_template_id) {
      const [layout] = await sql`SELECT zones FROM layout_templates WHERE id = ${deviceFull.layout_template_id}`;
      if (layout?.zones) layoutZones = layout.zones as unknown[];
    }

    return NextResponse.json({
      content_version: serverVersion,
      needs_update: needsUpdate,
      campaign_id: campaign.id,
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
