import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const contentVersion = parseInt(searchParams.get('content_version') || '0');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    const { data: device } = await supabase
      .from('devices')
      .select('id, organization_id, content_version, campaign_id')
      .eq('id', deviceId)
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    // Device MUST have a campaign_id linked. No campaign = no media.
    if (!device.campaign_id) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: null,
        playlists: [],
        media: [],
      });
    }

    // Fetch the specific campaign linked to this device
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, priority, status, start_date, end_date, start_time, end_time, days_of_week')
      .eq('id', device.campaign_id)
      .single();

    // Campaign must exist and be active
    if (!campaign || campaign.status !== 'active') {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        playlists: [],
        media: [],
      });
    }

    // Check date/time constraints
    const now = new Date();
    if (campaign.start_date && now < new Date(campaign.start_date)) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        playlists: [],
        media: [],
      });
    }
    if (campaign.end_date && now > new Date(campaign.end_date)) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        playlists: [],
        media: [],
      });
    }

    // Check campaign_targets — only if device was NOT directly linked via campaign_id
    // Direct link (device.campaign_id = X) means "this device plays this campaign" — skip targeting check
    const { data: targets } = await supabase
      .from('campaign_targets')
      .select('target_type, target_id')
      .eq('campaign_id', campaign.id);

    if (targets && targets.length > 0 && !device.campaign_id) {
      const { data: deviceUnit } = await supabase
        .from('devices')
        .select('unit_id')
        .eq('id', deviceId)
        .single();

      const isTargeted = targets.some(t =>
        (t.target_type === 'device' && t.target_id === deviceId) ||
        (t.target_type === 'unit' && deviceUnit?.unit_id && t.target_id === deviceUnit.unit_id)
      );
      if (!isTargeted) {
        return NextResponse.json({
          content_version: device.content_version || 0,
          needs_update: false,
          campaign_id: device.campaign_id,
          playlists: [],
          media: [],
        });
      }
    }

    // Auto-deactivate expired campaigns
    await supabase.rpc('deactivate_expired_campaigns');

    // Check time slots: find matching slot for current day/time
    const jsDow = now.getDay(); // 0=Sun,1=Mon...6=Sat
    const pgDow = jsDow === 0 ? 6 : jsDow - 1; // Convert to 0=Mon...6=Sun
    const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const { data: matchingSlot } = await supabase
      .from('campaign_time_slots')
      .select('playlist_id')
      .eq('campaign_id', campaign.id)
      .eq('day_of_week', pgDow)
      .lte('start_time', nowTime)
      .gt('end_time', nowTime)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get playlists for this campaign
    const { data: campaignPlaylists } = await supabase
      .from('campaign_playlists')
      .select('playlist_id, position, duration')
      .eq('campaign_id', campaign.id)
      .order('position', { ascending: true });

    if (!campaignPlaylists || campaignPlaylists.length === 0) {
      return NextResponse.json({
        content_version: device.content_version || 0,
        needs_update: false,
        campaign_id: device.campaign_id,
        playlists: [],
        media: [],
      });
    }

    // Determine which playlists to return
    let targetPlaylistIds: string[];
    if (matchingSlot?.playlist_id) {
      // Time slot matched — only return that playlist
      targetPlaylistIds = [matchingSlot.playlist_id];
    } else {
      // No time slot — return all campaign playlists (default behavior)
      targetPlaylistIds = campaignPlaylists.map(cp => cp.playlist_id);
    }

    const allPlaylists: Array<Record<string, unknown>> = [];
    const allMediaIds = new Set<string>();

    for (const cp of campaignPlaylists) {
      if (!targetPlaylistIds.includes(cp.playlist_id)) continue;

      const { data: pl } = await supabase
        .from('playlists')
        .select('id, name, description')
        .eq('id', cp.playlist_id)
        .single();

      if (!pl) continue;

      const { data: items } = await supabase
        .from('playlist_items')
        .select('*')
        .eq('playlist_id', pl.id)
        .order('position', { ascending: true });

      const playlistItems = items ?? [];

      allPlaylists.push({
        id: pl.id,
        name: pl.name,
        description: pl.description,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        position: cp.position,
        duration: cp.duration,
        items: playlistItems,
      });

      playlistItems.forEach(item => {
        const mediaId = (item as Record<string, unknown>).media_id;
        if (mediaId) allMediaIds.add(mediaId as string);
      });
    }

    // Fetch all media
    let mediaList: unknown[] = [];
    if (allMediaIds.size > 0) {
      const { data: media } = await supabase
        .from('media')
        .select('*')
        .in('id', Array.from(allMediaIds));
      mediaList = media ?? [];
    }

    let serverVersion = device.content_version || 0;
    if (serverVersion === 0 && allPlaylists.length > 0) {
      serverVersion = 1;
    }
    const needsUpdate = serverVersion > contentVersion;

    // Update device content_version
    if (allPlaylists.length > 0 && serverVersion > (device.content_version || 0)) {
      await supabase
        .from('devices')
        .update({ content_version: serverVersion, updated_at: new Date().toISOString() })
        .eq('id', deviceId);
    }

    // Also return layout info + zones
    const { data: deviceFull } = await supabase
      .from('devices')
      .select('layout_template_id')
      .eq('id', deviceId)
      .single();

    let layoutZones: unknown[] = [];
    if (deviceFull?.layout_template_id) {
      const { data: layout } = await supabase
        .from('layout_templates')
        .select('zones, width, height')
        .eq('id', deviceFull.layout_template_id)
        .single();
      if (layout?.zones) {
        layoutZones = layout.zones;
      }
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
