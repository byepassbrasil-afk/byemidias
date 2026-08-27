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

    let sessions;
    if (deviceId) {
      if (isSuperAdmin) {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.device_id = $2
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), deviceId]);
      } else {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.device_id = $2 AND dus.organization_id = $3
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), deviceId, orgId]);
      }
    } else {
      if (isSuperAdmin) {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString()]);
      } else {
        sessions = await sql.unsafe(`
          SELECT dus.*, d.name as device_name, d.model as device_model
          FROM device_uptime_sessions dus
          LEFT JOIN devices d ON d.id = dus.device_id
          WHERE dus.started_at >= $1 AND dus.organization_id = $2
          ORDER BY dus.started_at DESC
        `, [startDate.toISOString(), orgId]);
      }
    }

    const dailyUptime: Record<string, Record<string, number>> = {};

    for (const session of sessions || []) {
      const deviceName = session.device_name || session.device_id;
      const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
      const durationHours = (endedAt.getTime() - new Date(session.started_at).getTime()) / (1000 * 60 * 60);
      const dateKey = new Date(session.started_at).toISOString().split('T')[0];

      if (!dailyUptime[deviceName]) dailyUptime[deviceName] = {};
      dailyUptime[deviceName][dateKey] = (dailyUptime[deviceName][dateKey] || 0) + durationHours;
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
