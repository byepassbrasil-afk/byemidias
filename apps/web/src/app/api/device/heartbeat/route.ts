import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/device/heartbeat
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { device_id, status, player_version, storage_available, current_content, current_playlist, error_message, uptime_seconds, media_id, campaign_id, playlist_id } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    // Auto-deactivate expired campaigns (runs on every heartbeat)
    try { await supabase.rpc('deactivate_expired_campaigns'); } catch (_) {}

    // Update device — always set last_heartbeat to now for any non-offline status
    const updateData: Record<string, unknown> = {
      player_version: player_version || null,
      storage_available: storage_available || null,
    };

    if (status === 'offline') {
      updateData.last_heartbeat = '1970-01-01T00:00:00.000Z';
      updateData.status = 'offline';
    } else {
      updateData.last_heartbeat = new Date().toISOString();
      updateData.status = 'active';
    }

    const { error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('id', device_id);

    if (error) {
      console.error('Heartbeat update error:', error);
    }

    // Log heartbeat event
    const uptimeMin = uptime_seconds ? Math.round(uptime_seconds / 60) : null;
    const uptimeStr = uptimeMin !== null
      ? uptimeMin < 60 ? `${uptimeMin}min` : `${Math.floor(uptimeMin / 60)}h${uptimeMin % 60 > 0 ? `${uptimeMin % 60}min` : ''}`
      : null;

    const eventType = status === 'offline' ? 'disconnect' : (error_message ? 'error' : 'heartbeat');

    await supabase.from('device_logs').insert({
      device_id,
      event_type: eventType,
      message: status === 'offline'
        ? `Offline${uptimeStr ? ` after ${uptimeStr}` : ''}`
        : (error_message || (uptimeStr ? `Online ${uptimeStr}` : null)),
      uptime_seconds: uptime_seconds || null,
      player_version: player_version || null,
    });

    // Manage uptime session
    if (status === 'offline') {
      await supabase.rpc('close_stale_uptime_sessions');
      await supabase
        .from('device_uptime_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('device_id', device_id)
        .is('ended_at', null);
    } else {
      const { data: openSession } = await supabase
        .from('device_uptime_sessions')
        .select('id')
        .eq('device_id', device_id)
        .is('ended_at', null)
        .limit(1)
        .single();

      if (!openSession) {
        const { data: deviceInfo } = await supabase
          .from('devices')
          .select('organization_id')
          .eq('id', device_id)
          .single();

        if (deviceInfo) {
          await supabase.from('device_uptime_sessions').insert({
            device_id,
            organization_id: deviceInfo.organization_id,
            started_at: new Date().toISOString(),
          });
        }
      }
    }

    // Log playback if media_id is provided
    if (media_id && status === 'playing') {
      const { data: deviceInfo2 } = await supabase
        .from('devices')
        .select('organization_id')
        .eq('id', device_id)
        .single();

      await supabase.from('playback_logs').insert({
        device_id,
        organization_id: deviceInfo2?.organization_id || null,
        media_id,
        campaign_id: campaign_id || null,
        playlist_id: playlist_id || null,
        player_version: player_version || null,
      });
    }

    // Return device settings
    const { data: deviceData } = await supabase
      .from('devices')
      .select('content_version, restart_requested, screen_rotation, mirror_horizontal, mirror_vertical')
      .eq('id', device_id)
      .single();

    if (deviceData?.restart_requested) {
      await supabase
        .from('devices')
        .update({ restart_requested: false })
        .eq('id', device_id);
    }

    return NextResponse.json({
      success: true,
      uptime: uptimeStr,
      content_version: deviceData?.content_version || 0,
      restart: deviceData?.restart_requested || false,
      screen_rotation: deviceData?.screen_rotation || 0,
      mirror_horizontal: deviceData?.mirror_horizontal || false,
      mirror_vertical: deviceData?.mirror_vertical || false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/device/heartbeat error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/device/heartbeat?device_id=X — Get device logs
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!deviceId) {
      // Return all recent logs
      const { data } = await supabase
        .from('device_logs')
        .select('*, devices(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      return NextResponse.json({ logs: data ?? [] });
    }

    const { data } = await supabase
      .from('device_logs')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return NextResponse.json({ logs: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
