import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// POST /api/device/heartbeat
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, status, player_version, storage_available, error_message, uptime_seconds, media_id, campaign_id, playlist_id } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    // Auto-deactivate expired campaigns
    try { await sql`SELECT deactivate_expired_campaigns()`; } catch (_) {}

    // Update device
    if (status === 'offline') {
      await sql`UPDATE devices SET last_heartbeat = '1970-01-01T00:00:00Z', status = 'offline', player_version = ${player_version || null}, storage_available = ${storage_available || null} WHERE id = ${device_id}`;
    } else {
      await sql`UPDATE devices SET last_heartbeat = NOW(), status = 'online', player_version = ${player_version || null}, storage_available = ${storage_available || null} WHERE id = ${device_id}`;
    }

    // Log heartbeat event
    const uptimeMin = uptime_seconds ? Math.round(uptime_seconds / 60) : null;
    const uptimeStr = uptimeMin !== null
      ? uptimeMin < 60 ? `${uptimeMin}min` : `${Math.floor(uptimeMin / 60)}h${uptimeMin % 60 > 0 ? `${uptimeMin % 60}min` : ''}`
      : null;
    const eventType = status === 'offline' ? 'disconnect' : (error_message ? 'error' : 'heartbeat');
    const logMessage = status === 'offline'
      ? `Offline${uptimeStr ? ` after ${uptimeStr}` : ''}`
      : (error_message || (uptimeStr ? `Online ${uptimeStr}` : null));

    await sql`INSERT INTO device_logs (device_id, event_type, message, uptime_seconds, player_version) VALUES (${device_id}, ${eventType}, ${logMessage}, ${uptime_seconds || null}, ${player_version || null})`;

    // Manage uptime session
    if (status === 'offline') {
      await sql`SELECT close_stale_uptime_sessions()`;
      await sql`UPDATE device_uptime_sessions SET ended_at = NOW() WHERE device_id = ${device_id} AND ended_at IS NULL`;
    } else {
      const [openSession] = await sql`SELECT id FROM device_uptime_sessions WHERE device_id = ${device_id} AND ended_at IS NULL LIMIT 1`;
      if (!openSession) {
        const [deviceInfo] = await sql`SELECT organization_id FROM devices WHERE id = ${device_id}`;
        if (deviceInfo) {
          await sql`INSERT INTO device_uptime_sessions (device_id, organization_id, started_at) VALUES (${device_id}, ${deviceInfo.organization_id}, NOW())`;
        }
      }
    }

    // Log playback if media_id is provided
    if (media_id && status === 'playing') {
      const [deviceInfo2] = await sql`SELECT organization_id FROM devices WHERE id = ${device_id}`;
      await sql`INSERT INTO playback_logs (device_id, organization_id, media_id, campaign_id, playlist_id, player_version) VALUES (${device_id}, ${deviceInfo2?.organization_id || null}, ${media_id}, ${campaign_id || null}, ${playlist_id || null}, ${player_version || null})`;
    }

    // Return device settings
    const [deviceData] = await sql`SELECT content_version, restart_requested, screen_rotation, mirror_horizontal, mirror_vertical FROM devices WHERE id = ${device_id}`;

    if (deviceData?.restart_requested) {
      await sql`UPDATE devices SET restart_requested = false WHERE id = ${device_id}`;
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

// GET /api/device/heartbeat?device_id=X
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!deviceId) {
      const logs = await sql`SELECT dl.*, d.name as device_name FROM device_logs dl LEFT JOIN devices d ON d.id = dl.device_id ORDER BY dl.created_at DESC LIMIT ${limit}`;
      return NextResponse.json({ logs });
    }

    const logs = await sql`SELECT * FROM device_logs WHERE device_id = ${deviceId} ORDER BY created_at DESC LIMIT ${limit}`;
    return NextResponse.json({ logs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
