import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/device/sync - Get content sync for device
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const contentVersion = parseInt(searchParams.get('content_version') || '0');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    // Get device info
    const { data: device } = await supabase
      .from('devices')
      .select('id, organization_id, playlist_id, content_version')
      .eq('id', deviceId)
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    // Get device's playlist via partner_devices or direct assignment
    let playlistId = device.playlist_id;

    if (!playlistId) {
      // Try to get from partner_devices
      const { data: partnerDevice } = await supabase
        .from('partner_devices')
        .select('playlist_id')
        .eq('device_id', deviceId)
        .not('playlist_id', 'is', null)
        .limit(1)
        .single();

      playlistId = partnerDevice?.playlist_id;
    }

    // Get the latest approved version of the playlist
    let playlist = null;
    let playlistItems: unknown[] = [];

    if (playlistId) {
      // Get the approved version (latest)
      const { data: pl } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .eq('approval_status', 'approved')
        .single();

      playlist = pl;

      if (playlist) {
        // Get playlist items
        const { data: items } = await supabase
          .from('playlist_items')
          .select('*')
          .eq('playlist_id', playlist.id)
          .order('position', { ascending: true });

        playlistItems = items ?? [];
      }
    }

    // Get media for the playlist items
    const mediaIds = playlistItems
      .map((item) => (item as Record<string, unknown>).media_id)
      .filter(Boolean) as string[];
    let mediaList: unknown[] = [];

    if (mediaIds.length > 0) {
      const { data: media } = await supabase
        .from('media')
        .select('*')
        .in('id', mediaIds as string[]);

      mediaList = media ?? [];
    }

    // Get active campaigns for this device's organization
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('organization_id', device.organization_id)
      .eq('status', 'active');

    // Build response
    const serverVersion = device.content_version || 0;
    const needsUpdate = serverVersion > contentVersion;

    return NextResponse.json({
      content_version: serverVersion,
      needs_update: needsUpdate,
      playlists: playlist ? [{
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        items: playlistItems,
      }] : [],
      media: mediaList,
      campaigns: campaigns ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/device/sync error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
