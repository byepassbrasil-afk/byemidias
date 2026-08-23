import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/reports?type=basic|campaign|activity|financial&days=30&org_id=X
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'basic';
    const days = parseInt(searchParams.get('days') || '30');
    const orgId = searchParams.get('org_id');
    const deviceId = searchParams.get('device_id');
    const campaignId = searchParams.get('campaign_id');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Close stale uptime sessions
    await supabase.rpc('close_stale_uptime_sessions');

    switch (type) {
      case 'basic': {
        // Device summary with uptime
        let deviceQuery = supabase.from('devices').select('id, name, model, player_version, status, last_heartbeat, content_version');
        if (orgId) deviceQuery = deviceQuery.eq('organization_id', orgId);
        const { data: devices } = await deviceQuery;

        // Uptime per device
        let uptimeQuery = supabase
          .from('device_uptime_sessions')
          .select('device_id, started_at, ended_at')
          .gte('started_at', startDate.toISOString());
        if (orgId) uptimeQuery = uptimeQuery.eq('organization_id', orgId);
        const { data: uptimeSessions } = await uptimeQuery;

        // Playback counts per device
        let playbackQuery = supabase
          .from('playback_logs')
          .select('device_id, media_id, campaign_id')
          .gte('played_at', startDate.toISOString());
        if (orgId) playbackQuery = playbackQuery.eq('organization_id', orgId);
        const { data: playbackLogs } = await playbackQuery;

        // Media count
        let mediaQuery = supabase.from('media').select('id', { count: 'exact', head: true });
        if (orgId) mediaQuery = mediaQuery.eq('organization_id', orgId);
        const { count: mediaCount } = await mediaQuery;

        // Campaign count
        let campaignQuery = supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active');
        if (orgId) campaignQuery = campaignQuery.eq('organization_id', orgId);
        const { count: campaignCount } = await campaignQuery;

        // Calculate uptime per device
        const uptimeByDevice: Record<string, number> = {};
        for (const s of uptimeSessions || []) {
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          const hours = (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
          uptimeByDevice[s.device_id] = (uptimeByDevice[s.device_id] || 0) + hours;
        }

        // Playback counts per device
        const playbackByDevice: Record<string, number> = {};
        for (const p of playbackLogs || []) {
          playbackByDevice[p.device_id] = (playbackByDevice[p.device_id] || 0) + 1;
        }

        // Online/offline status
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
            total_media: mediaCount || 0,
            active_campaigns: campaignCount || 0,
            total_plays: playbackLogs?.length || 0,
            period_days: days,
          },
          devices: (devices || []).map(d => ({
            ...d,
            uptime_hours: Math.round((uptimeByDevice[d.id] || 0) * 100) / 100,
            play_count: playbackByDevice[d.id] || 0,
            is_online: d.last_heartbeat ? new Date(d.last_heartbeat) > fiveMinAgo : false,
          })),
        });
      }

      case 'campaign': {
        let query = supabase
          .from('playback_logs')
          .select('campaign_id, campaigns(name), media_id, media(name, type), played_at')
          .gte('played_at', startDate.toISOString())
          .not('campaign_id', 'is', null);

        if (orgId) query = query.eq('organization_id', orgId);
        if (campaignId) query = query.eq('campaign_id', campaignId);

        const { data: logs } = await query;

        // Aggregate by campaign
        const campaignStats: Record<string, { name: string; plays: number; media: Record<string, number> }> = {};
        for (const log of logs || []) {
          const cid = log.campaign_id;
          const cname = (Array.isArray(log.campaigns) ? log.campaigns[0] : log.campaigns)?.name || 'Unknown';
          const mname = (Array.isArray(log.media) ? log.media[0] : log.media)?.name || 'Unknown';

          if (!campaignStats[cid]) campaignStats[cid] = { name: cname, plays: 0, media: {} };
          campaignStats[cid].plays++;
          campaignStats[cid].media[mname] = (campaignStats[cid].media[mname] || 0) + 1;
        }

        return NextResponse.json({
          campaigns: Object.entries(campaignStats).map(([id, stats]) => ({
            id,
            ...stats,
            top_media: Object.entries(stats.media)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, count]) => ({ name, count })),
          })),
          total_plays: logs?.length || 0,
          period_days: days,
        });
      }

      case 'activity': {
        // Hourly activity heatmap
        let query = supabase
          .from('playback_logs')
          .select('played_at, device_id, devices(name)')
          .gte('played_at', startDate.toISOString());

        if (orgId) query = query.eq('organization_id', orgId);
        if (deviceId) query = query.eq('device_id', deviceId);

        const { data: logs } = await query;

        // Build hourly heatmap: day_of_week x hour
        const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        const hourlyTotal: number[] = Array(24).fill(0);
        const dailyTotal: number[] = Array(7).fill(0);

        for (const log of logs || []) {
          const d = new Date(log.played_at);
          const day = d.getDay();
          const hour = d.getHours();
          heatmap[day][hour]++;
          hourlyTotal[hour]++;
          dailyTotal[day]++;
        }

        // Device activity
        const deviceActivity: Record<string, { name: string; plays: number }> = {};
        for (const log of logs || []) {
          const did = log.device_id;
          const dname = (Array.isArray(log.devices) ? log.devices[0] : log.devices)?.name || 'Unknown';
          if (!deviceActivity[did]) deviceActivity[did] = { name: dname, plays: 0 };
          deviceActivity[did].plays++;
        }

        return NextResponse.json({
          heatmap,
          hourly_total: hourlyTotal,
          daily_total: dailyTotal,
          device_activity: Object.values(deviceActivity).sort((a, b) => b.plays - a.plays),
          total_events: logs?.length || 0,
          period_days: days,
        });
      }

      case 'financial': {
        // Partner uptime + estimated payments
        let uptimeQuery = supabase
          .from('device_uptime_sessions')
          .select('device_id, partner_id, started_at, ended_at, organization_id')
          .gte('started_at', startDate.toISOString());

        if (orgId) uptimeQuery = uptimeQuery.eq('organization_id', orgId);
        const { data: sessions } = await uptimeQuery;

        // Get partner payment settings
        const { data: payments } = await supabase
          .from('partner_payments')
          .select('*')
          .eq('is_active', true);

        // Calculate uptime per partner
        const partnerUptime: Record<string, { hours: number; devices: Set<string> }> = {};
        for (const s of sessions || []) {
          const pid = s.partner_id || 'unassigned';
          if (!partnerUptime[pid]) partnerUptime[pid] = { hours: 0, devices: new Set() };
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          partnerUptime[pid].hours += (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
          partnerUptime[pid].devices.add(s.device_id);
        }

        // Calculate estimated amounts
        const financialSummary = Object.entries(partnerUptime).map(([partnerId, data]) => {
          const payment = payments?.find(p => p.partner_id === partnerId);
          const hours = Math.round(data.hours * 100) / 100;
          const amount = payment?.payment_type === 'hourly'
            ? hours * (payment.hourly_rate || 0)
            : (payment?.monthly_rate || 0) * Math.ceil(days / 30);

          return {
            partner_id: partnerId,
            hours,
            devices_count: data.devices.size,
            hourly_rate: payment?.hourly_rate || 0,
            monthly_rate: payment?.monthly_rate || 0,
            payment_type: payment?.payment_type || 'hourly',
            estimated_amount: Math.round(amount * 100) / 100,
          };
        });

        const totalAmount = financialSummary.reduce((sum, f) => sum + f.estimated_amount, 0);
        const totalHours = financialSummary.reduce((sum, f) => sum + f.hours, 0);

        return NextResponse.json({
          partners: financialSummary.sort((a, b) => b.estimated_amount - a.estimated_amount),
          total_hours: Math.round(totalHours * 100) / 100,
          total_amount: Math.round(totalAmount * 100) / 100,
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
