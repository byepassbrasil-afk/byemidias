import { NextResponse, NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';
import { sendPushToOrg } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// POST /api/device/heartbeat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, status, player_version, storage_available, error_message, uptime_seconds, media_id, campaign_id, playlist_id } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();

    // 1. Buscar estado anterior do device
    let prevDevice: any = null;
    try {
      const filter = `id = "${device_id}"`;
      const list = await pb.collection('devices').getList(1, 1, { filter });
      if (list.items.length > 0) prevDevice = list.items[0];
    } catch (e) {
      console.error('[heartbeat] erro ao buscar device:', e);
    }

    if (!prevDevice) {
      return NextResponse.json({ error: 'device não encontrado' }, { status: 404 });
    }

    // 2. Atualizar device
    const isOffline = status === 'offline';
    const updateData: any = {
      player_version: player_version || null,
      storage_available: storage_available || null,
    };

    if (isOffline) {
      updateData.last_heartbeat = '1970-01-01T00:00:00Z';
      updateData.status = 'offline';
    } else {
      updateData.last_heartbeat = new Date().toISOString();
      updateData.status = 'online';
    }

    await pb.collection('devices').update(device_id, updateData);

    // 3. Notificações de mudança de status
    if (prevDevice && prevDevice.status !== updateData.status) {
      try {
        await pb.collection('notifications').create({
          organization_id: prevDevice.organization_id,
          type: isOffline ? 'device_offline' : 'device_online',
          title: isOffline ? 'Dispositivo Offline' : 'Dispositivo Online',
          message: isOffline
            ? `O dispositivo "${prevDevice.name}" ficou offline.`
            : `O dispositivo "${prevDevice.name}" voltou ao online.`,
          device_id: device_id,
        });
        sendPushToOrg(
          prevDevice.organization_id,
          isOffline ? '🔴 Dispositivo Offline' : '🟢 Dispositivo Online',
          isOffline
            ? `O dispositivo "${prevDevice.name}" ficou offline.`
            : `O dispositivo "${prevDevice.name}" voltou ao online.`,
          '/dashboard/monitoring'
        ).catch(() => {});
      } catch (e) {
        console.error('[heartbeat] erro notification:', e);
      }
    }

    // 4. Log no device_logs
    const uptimeMin = uptime_seconds ? Math.round(uptime_seconds / 60) : null;
    const uptimeStr = uptimeMin !== null
      ? uptimeMin < 60 ? `${uptimeMin}min` : `${Math.floor(uptimeMin / 60)}h${uptimeMin % 60 > 0 ? `${uptimeMin % 60}min` : ''}`
      : null;
    const eventType = isOffline ? 'disconnect' : (error_message ? 'error' : 'heartbeat');
    const logMessage = isOffline
      ? `Offline${uptimeStr ? ` after ${uptimeStr}` : ''}`
      : (error_message || (uptimeStr ? `Online ${uptimeStr}` : null));

    try {
      await pb.collection('device_logs').create({
        device_id,
        event_type: eventType,
        message: logMessage,
        uptime_seconds: uptime_seconds || null,
        player_version: player_version || null,
      });
    } catch (e) {
      console.error('[heartbeat] erro device_logs:', e);
    }

    // 5. Gerenciar uptime sessions
    if (isOffline) {
      try {
        const openSessions = await pb.collection('device_uptime_sessions').getList(1, 200, {
          filter: `device_id = "${device_id}" && ended_at = null`,
        });
        for (const s of openSessions.items) {
          await pb.collection('device_uptime_sessions').update(s.id, {
            ended_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('[heartbeat] erro uptime close:', e);
      }
    } else {
      try {
        const openSessions = await pb.collection('device_uptime_sessions').getList(1, 1, {
          filter: `device_id = "${device_id}" && ended_at = null`,
        });
        if (openSessions.items.length === 0) {
          await pb.collection('device_uptime_sessions').create({
            device_id,
            organization_id: prevDevice.organization_id,
            started_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('[heartbeat] erro uptime create:', e);
      }
    }

    // 6. Log playback (APENAS quando muda de mídia, não em todo heartbeat)
    if (media_id && !isOffline && media_id !== prevDevice?.last_media_id) {
      try {
        // Verifica se já tem registro recente (último minuto) para evitar duplicatas
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        const recentLogs = await pb.collection('playback_logs').getList(1, 1, {
          filter: `device_id = "${device_id}" && media_id = "${media_id}" && timestamp > "${oneMinuteAgo}"`,
        });

        if (recentLogs.items.length === 0) {
          await pb.collection('playback_logs').create({
            device_id,
            organization_id: prevDevice.organization_id,
            media_id,
            campaign_id: campaign_id || null,
            playlist_id: playlist_id || null,
            player_version: player_version || null,
            timestamp: new Date().toISOString(),
          });
        }

        // Salva o last_media_id no device para detectar mudança
        await pb.collection('devices').update(device_id, {
          last_media_id: media_id,
        });
      } catch (e) {
        console.error('[heartbeat] erro playback_logs:', e);
      }
    }

    // 7. Buscar comandos pendentes (sem SQL raw!)
    let pendingCommands: any[] = [];
    if (!isOffline) {
      try {
        const cmds = await pb.collection('device_commands').getList(1, 5, {
          filter: `device_id = "${device_id}" && executed_at = null`,
          sort: 'created_at',
        });
        pendingCommands = cmds.items;

        for (const cmd of pendingCommands) {
          try {
            await pb.collection('device_commands').update(cmd.id, {
              executed_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error('[heartbeat] erro marcar comando:', e);
          }
        }
      } catch (e) {
        console.error('[heartbeat] erro buscar comandos:', e);
      }
    }

    // 8. Configurações do device
    let effectiveRotation = prevDevice.screen_rotation || 0;
    if (!prevDevice.screen_rotation && prevDevice.orientation) {
      effectiveRotation = prevDevice.orientation === 'portrait' ? 0 : 90;
    }

    // Reset restart_requested
    if (prevDevice.restart_requested) {
      try {
        await pb.collection('devices').update(device_id, { restart_requested: false });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      uptime: uptimeStr,
      content_version: prevDevice.content_version || 0,
      player_version: updateData.player_version || prevDevice.player_version || null,
      restart: prevDevice.restart_requested || false,
      screen_rotation: effectiveRotation,
      video_volume: prevDevice.video_volume ?? 100,
      image_fit_mode: prevDevice.image_fit_mode || 'centerCrop',
      image_rotation_lock: prevDevice.image_rotation_lock ?? 0,
      video_player: prevDevice.video_player || 'exoplayer',
      html_render: prevDevice.html_render || 'native',
      auto_update: prevDevice.auto_update ?? true,
      low_mem_restart: prevDevice.low_mem_restart ?? true,
      support_id: prevDevice.support_id || '',
      support_type: prevDevice.support_type || 'anydesk',
      orientation: prevDevice.orientation || 'landscape',
      mirror_horizontal: prevDevice.mirror_horizontal || false,
      mirror_vertical: prevDevice.mirror_vertical || false,
      commands: pendingCommands.map((c: any) => ({
        command: c.command,
        payload: typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload,
      })),
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[heartbeat] erro:', msg, e.data);
    return NextResponse.json({ error: msg, data: e.data }, { status: 500 });
  }
}

// GET /api/device/heartbeat?device_id=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    const pb = await getAdminClient();

    if (!deviceId) {
      // Lista todos os logs (limitado)
      const logs = await pb.collection('device_logs').getList(1, limit, { sort: '-id' });
      return NextResponse.json({ logs: logs.items });
    }

    const logs = await pb.collection('device_logs').getList(1, limit, {
      filter: `device_id = "${deviceId}"`,
      sort: '-id',
    });
    return NextResponse.json({ logs: logs.items });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[heartbeat GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
