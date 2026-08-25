import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'basic';
    const days = parseInt(searchParams.get('days') || '30');
    const orgId = searchParams.get('org_id');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    switch (type) {
      case 'basic': {
        let devices;
        if (orgId) {
          devices = await sql`SELECT id, name, model, player_version, status, last_heartbeat, content_version FROM devices WHERE organization_id = ${orgId}`;
        } else {
          devices = await sql`SELECT id, name, model, player_version, status, last_heartbeat, content_version FROM devices`;
        }

        const uptimeSessions = orgId
          ? await sql`SELECT device_id, started_at, ended_at FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId}`
          : await sql`SELECT device_id, started_at, ended_at FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()}`;

        let mediaCountResult;
        if (orgId) {
          mediaCountResult = await sql`SELECT count(*) FROM media WHERE organization_id = ${orgId}`;
        } else {
          mediaCountResult = await sql`SELECT count(*) FROM media`;
        }

        let campaignCountResult;
        if (orgId) {
          campaignCountResult = await sql`SELECT count(*) FROM campaigns WHERE status = 'active' AND organization_id = ${orgId}`;
        } else {
          campaignCountResult = await sql`SELECT count(*) FROM campaigns WHERE status = 'active'`;
        }

        const uptimeByDevice: Record<string, number> = {};
        for (const s of uptimeSessions || []) {
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          const hours = (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
          uptimeByDevice[s.device_id] = (uptimeByDevice[s.device_id] || 0) + hours;
        }

        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
        let onlineCount = 0;
        let offlineCount = 0;

        for (const d of devices || []) {
          const lastHb = d.last_heartbeat ? new Date(d.last_heartbeat) : null;
          if (lastHb && lastHb > fiveMinAgo) onlineCount++;
          else offlineCount++;
        }

        return NextResponse.json({
          summary: {
            total_devices: devices?.length || 0,
            online_devices: onlineCount,
            offline_devices: offlineCount,
            total_media: Number(mediaCountResult?.[0]?.count) || 0,
            active_campaigns: Number(campaignCountResult?.[0]?.count) || 0,
            period_days: days,
          },
          devices: (devices || []).map(d => ({
            ...d,
            uptime_hours: Math.round((uptimeByDevice[d.id] || 0) * 100) / 100,
            is_online: d.last_heartbeat ? new Date(d.last_heartbeat) > fiveMinAgo : false,
          })),
        });
      }

      case 'campaign': {
        return NextResponse.json({ campaigns: [], total_plays: 0, period_days: days });
      }

      case 'activity': {
        return NextResponse.json({ heatmap: [], hourly_total: [], daily_total: [], device_activity: [], total_events: 0, period_days: days });
      }

      case 'financial': {
        const sessions = orgId
          ? await sql`SELECT device_id, started_at, ended_at, organization_id FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId}`
          : await sql`SELECT device_id, started_at, ended_at, organization_id FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()}`;

        const deviceHours: Record<string, number> = {};
        for (const s of sessions || []) {
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          const hours = (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
          deviceHours[s.device_id] = (deviceHours[s.device_id] || 0) + hours;
        }

        const totalHours = Object.values(deviceHours).reduce((sum, h) => sum + h, 0);

        return NextResponse.json({
          devices: Object.entries(deviceHours).map(([device_id, hours]) => ({
            device_id, hours: Math.round(hours * 100) / 100,
          })),
          total_hours: Math.round(totalHours * 100) / 100,
          total_amount: 0,
          period_days: days,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
