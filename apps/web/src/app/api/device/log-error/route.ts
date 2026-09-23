import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { device_id, event_type, severity, message, details, media_id, media_url, campaign_id, playlist_id } = body;

    if (!device_id) return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    if (!event_type) return NextResponse.json({ error: 'event_type obrigatório' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 });

    // Get device org
    const [device] = await sql`SELECT organization_id, name FROM devices WHERE id = ${device_id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });

    // Permission check: device must belong to user's org (or super_admin)
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Insert device_log
    await sql`
      INSERT INTO device_logs (device_id, event_type, severity, message, details, media_id, media_url, campaign_id, playlist_id)
      VALUES (
        ${device_id},
        ${event_type},
        ${severity || 'info'},
        ${message},
        ${details || null},
        ${media_id || null},
        ${media_url || null},
        ${campaign_id || null},
        ${playlist_id || null}
      )
    `;

    // For errors and warnings, also create a notification
    const sev = (severity || 'info').toLowerCase();
    if (sev === 'error' || sev === 'warning') {
      await sql`
        INSERT INTO notifications (organization_id, type, title, message, device_id, severity)
        VALUES (
          ${device.organization_id},
          ${'device_' + event_type},
          ${'⚠️ ' + (device.name || 'Dispositivo') + ': ' + message.substring(0, 80)},
          ${message + (details ? ' — ' + String(details).substring(0, 200) : '')},
          ${device_id},
          ${sev}
        )
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/device/log-error error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

