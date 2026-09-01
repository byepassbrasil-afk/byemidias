import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel Cron job — closes any uptime sessions that have been open
 * for more than 10 minutes without an active heartbeat.
 * Run hourly.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // Close sessions where device is offline (no heartbeat in 10 min)
    const closedByDevice = await sql`
      UPDATE device_uptime_sessions SET ended_at = d.last_heartbeat
      FROM devices d
      WHERE device_uptime_sessions.device_id = d.id
        AND device_uptime_sessions.ended_at IS NULL
        AND d.last_heartbeat IS NOT NULL
        AND d.last_heartbeat < NOW() - INTERVAL '10 minutes'
      RETURNING id
    `;

    // Close orphan sessions (device never had a heartbeat)
    const closedOrphans = await sql`
      UPDATE device_uptime_sessions SET ended_at = NOW()
      WHERE ended_at IS NULL
        AND started_at < NOW() - INTERVAL '10 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM devices d WHERE d.id = device_uptime_sessions.device_id AND d.last_heartbeat > NOW() - INTERVAL '10 minutes'
        )
      RETURNING id
    `;

    return NextResponse.json({
      closed_by_device_offline: (closedByDevice ?? []).length,
      closed_orphans: (closedOrphans ?? []).length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
