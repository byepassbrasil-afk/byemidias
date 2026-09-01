import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    // Close stale open sessions (no heartbeat in 10 minutes) — use last_heartbeat from devices table
    await sql.unsafe(`
      UPDATE device_uptime_sessions SET ended_at = d.last_heartbeat
      FROM devices d
      WHERE device_uptime_sessions.device_id = d.id
        AND device_uptime_sessions.ended_at IS NULL
        AND d.last_heartbeat IS NOT NULL
        AND d.last_heartbeat < NOW() - INTERVAL '10 minutes'
    `);
    // Close any remaining open sessions where last_heartbeat is null
    await sql.unsafe(`
      UPDATE device_uptime_sessions SET ended_at = NOW()
      WHERE ended_at IS NULL
        AND started_at < NOW() - INTERVAL '10 minutes'
    `);

    let sessions;
    if (deviceId) {
      if (isSuperAdmin) {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model, d.last_heartbeat as device_last_heartbeat
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.device_id = $2
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), deviceId]);
      } else {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model, d.last_heartbeat as device_last_heartbeat
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.device_id = $2 AND dus.organization_id = $3
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), deviceId, orgId]);
      }
    } else {
      if (isSuperAdmin) {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model, d.last_heartbeat as device_last_heartbeat
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString()]);
      } else {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model, d.last_heartbeat as device_last_heartbeat
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.organization_id = $2
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), orgId]);
      }
    }

    // Build per-day per-device uptime map (split across days at midnight)
    const dailyUptime: Record<string, Record<string, number>> = {};

    for (const session of sessions || []) {
      const deviceName = session.device_name || session.device_id;
      // Cap end time at NOW (not last_heartbeat, since the calc must reflect "active" time)
      const start = new Date(session.started_at);
      let end = session.ended_at ? new Date(session.ended_at) : new Date();
      // If session has no ended_at (was open at calc time), assume it ended at the device's last heartbeat
      if (!session.ended_at && session.device_last_heartbeat) {
        end = new Date(session.device_last_heartbeat);
      }
      // Cap end at NOW — never count future
      const now = new Date();
      if (end > now) end = now;
      if (end <= start) continue; // zero-duration session, skip

      const dayMs = 24 * 60 * 60 * 1000;
      let cursor = new Date(start);

      while (cursor < end) {
        const dayStart = new Date(cursor);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + dayMs);
        const segmentEnd = end < dayEnd ? end : dayEnd;
        const segmentHours = (segmentEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60);
        const dateKey = dayStart.toISOString().split('T')[0];

        if (!dailyUptime[deviceName]) dailyUptime[deviceName] = {};
        dailyUptime[deviceName][dateKey] = (dailyUptime[deviceName][dateKey] || 0) + segmentHours;

        cursor = new Date(segmentEnd);
      }
    }

    const deviceSummaries = Object.entries(dailyUptime).map(([device, daysData]) => {
      const totalHours = Object.values(daysData).reduce((sum, h) => sum + h, 0);
      return {
        device,
        total_hours: Math.round(totalHours * 100) / 100,
        days_online: Object.keys(daysData).length,
        daily: daysData,
      };
    });

    let payments;
    if (isSuperAdmin) {
      payments = await sql.unsafe('SELECT * FROM partner_payments');
    } else {
      payments = await sql`SELECT * FROM partner_payments WHERE organization_id = ${orgId}`;
    }

    return NextResponse.json({
      sessions: sessions || [],
      summaries: deviceSummaries,
      payments: payments || [],
      period: { start: startDate.toISOString(), end: new Date().toISOString(), days },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
