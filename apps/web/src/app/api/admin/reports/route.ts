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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    switch (type) {
      case 'basic': {
        const devices = isSuperAdmin
          ? await sql`SELECT id, name, model, player_version, status, last_heartbeat, content_version FROM devices`
          : await sql`SELECT id, name, model, player_version, status, last_heartbeat, content_version FROM devices WHERE organization_id = ${orgId}`;

        const uptimeSessions = isSuperAdmin
          ? await sql`SELECT device_id, started_at, ended_at FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()}`
          : await sql`SELECT device_id, started_at, ended_at FROM device_uptime_sessions WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId}`;

        const mediaCountResult = isSuperAdmin
          ? await sql`SELECT count(*) FROM media`
          : await sql`SELECT count(*) FROM media WHERE organization_id = ${orgId}`;

        const campaignCountResult = isSuperAdmin
          ? await sql`SELECT count(*) FROM campaigns WHERE status = 'active'`
          : await sql`SELECT count(*) FROM campaigns WHERE status = 'active' AND organization_id = ${orgId}`;

        const playsResult = isSuperAdmin
          ? await sql`SELECT count(*) FROM playback_logs WHERE started_at >= ${startDate.toISOString()}`
          : await sql`SELECT count(*) FROM playback_logs WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId}`;

        const playsByDeviceResult = isSuperAdmin
          ? await sql`SELECT device_id, count(*)::int as plays FROM playback_logs WHERE started_at >= ${startDate.toISOString()} GROUP BY device_id`
          : await sql`SELECT device_id, count(*)::int as plays FROM playback_logs WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId} GROUP BY device_id`;

        const playsByDevice: Record<string, number> = {};
        for (const r of playsByDeviceResult || []) {
          playsByDevice[r.device_id] = r.plays;
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
            total_plays: Number(playsResult?.[0]?.count) || 0,
            period_days: days,
          },
          devices: (devices || []).map(d => ({
            id: d.id,
            name: d.name,
            model: d.model,
            player_version: d.player_version,
            status: d.status,
            uptime_hours: Math.round((uptimeByDevice[d.id] || 0) * 100) / 100,
            is_online: d.last_heartbeat ? new Date(d.last_heartbeat) > fiveMinAgo : false,
            play_count: playsByDevice[d.id] || 0,
          })),
        });
      }

      case 'campaign': {
        // Reproduções agrupadas por campanha + top 5 mídias por campanha
        const playsByCampaign = isSuperAdmin
          ? await sql`
            SELECT pl.campaign_id, count(*)::int as plays
            FROM playback_logs pl
            WHERE pl.started_at >= ${startDate.toISOString()} AND pl.campaign_id IS NOT NULL
            GROUP BY pl.campaign_id
            ORDER BY plays DESC
          `
          : await sql`
            SELECT pl.campaign_id, count(*)::int as plays
            FROM playback_logs pl
            WHERE pl.started_at >= ${startDate.toISOString()}
              AND pl.campaign_id IS NOT NULL
              AND pl.organization_id = ${orgId}
            GROUP BY pl.campaign_id
            ORDER BY plays DESC
          `;

        const totalPlays = playsByCampaign.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.plays || 0), 0);

        if (playsByCampaign.length === 0) {
          return NextResponse.json({ campaigns: [], total_plays: 0, period_days: days });
        }

        const campaignIds: string[] = playsByCampaign.map((r: Record<string, unknown>) => r.campaign_id as string);

        const campaigns = isSuperAdmin
          ? await sql`SELECT id, name, status FROM campaigns WHERE id = ANY(${campaignIds})`
          : await sql`SELECT id, name, status FROM campaigns WHERE id = ANY(${campaignIds}) AND organization_id = ${orgId}`;

        const topMediaByCampaign = isSuperAdmin
          ? await sql`
            SELECT pl.campaign_id, pl.media_id, count(*)::int as count, m.name
            FROM playback_logs pl
            LEFT JOIN media m ON m.id = pl.media_id
            WHERE pl.started_at >= ${startDate.toISOString()}
              AND pl.campaign_id = ANY(${campaignIds})
            GROUP BY pl.campaign_id, pl.media_id, m.name
            ORDER BY pl.campaign_id, count DESC
          `
          : await sql`
            SELECT pl.campaign_id, pl.media_id, count(*)::int as count, m.name
            FROM playback_logs pl
            LEFT JOIN media m ON m.id = pl.media_id
            WHERE pl.started_at >= ${startDate.toISOString()}
              AND pl.campaign_id = ANY(${campaignIds})
              AND pl.organization_id = ${orgId}
            GROUP BY pl.campaign_id, pl.media_id, m.name
            ORDER BY pl.campaign_id, count DESC
          `;

        // Agrupa top_media por campanha (limita a 5)
        const topMediaMap: Record<string, Array<Record<string, unknown>>> = {};
        for (const row of topMediaByCampaign) {
          if (!topMediaMap[row.campaign_id]) topMediaMap[row.campaign_id] = [];
          if (topMediaMap[row.campaign_id].length < 5) {
            topMediaMap[row.campaign_id].push({ id: row.media_id, name: row.name ?? '—', count: row.count });
          }
        }

        const result = campaigns.map((c: Record<string, unknown>) => {
          const plays = playsByCampaign.find((r: Record<string, unknown>) => r.campaign_id === c.id);
          return {
            id: c.id,
            name: c.name,
            status: c.status,
            plays: Number(plays?.plays || 0),
            top_media: topMediaMap[c.id as string] || [],
          };
        }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.plays as number) - (a.plays as number));

        return NextResponse.json({ campaigns: result, total_plays: totalPlays, period_days: days });
      }

      case 'activity': {
        // Heatmap 7x24 (dia_semana x hora) a partir de playback_logs
        const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        const hourly: number[] = Array(24).fill(0);
        const daily: number[] = Array(7).fill(0);

        const plays = isSuperAdmin
          ? await sql`
            SELECT EXTRACT(DOW FROM started_at AT TIME ZONE 'America/Sao_Paulo')::int as dow,
                   EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Sao_Paulo')::int as hr
            FROM playback_logs
            WHERE started_at >= ${startDate.toISOString()}
          `
          : await sql`
            SELECT EXTRACT(DOW FROM started_at AT TIME ZONE 'America/Sao_Paulo')::int as dow,
                   EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Sao_Paulo')::int as hr
            FROM playback_logs
            WHERE started_at >= ${startDate.toISOString()} AND organization_id = ${orgId}
          `;

        for (const p of plays) {
          // Postgres DOW: 0=Dom, 1=Seg, ... 6=Sáb
          // Mapeia pro índice 0=Dom, ... 6=Sáb (igual ao array)
          const dayIdx = p.dow;
          const hourIdx = p.hr;
          if (dayIdx >= 0 && dayIdx < 7 && hourIdx >= 0 && hourIdx < 24) {
            heatmap[dayIdx][hourIdx]++;
            hourly[hourIdx]++;
            daily[dayIdx]++;
          }
        }

        const totalEvents = plays.length;

        // Atividade por device
        const deviceActivity = isSuperAdmin
          ? await sql`
            SELECT pl.device_id, count(*)::int as plays, d.name
            FROM playback_logs pl
            LEFT JOIN devices d ON d.id = pl.device_id
            WHERE pl.started_at >= ${startDate.toISOString()}
            GROUP BY pl.device_id, d.name
            ORDER BY plays DESC
            LIMIT 20
          `
          : await sql`
            SELECT pl.device_id, count(*)::int as plays, d.name
            FROM playback_logs pl
            LEFT JOIN devices d ON d.id = pl.device_id
            WHERE pl.started_at >= ${startDate.toISOString()} AND pl.organization_id = ${orgId}
            GROUP BY pl.device_id, d.name
            ORDER BY plays DESC
            LIMIT 20
          `;

        return NextResponse.json({
          heatmap,
          hourly_total: hourly,
          daily_total: daily,
          device_activity: deviceActivity.map((d: Record<string, unknown>) => ({
            id: d.device_id,
            name: d.name,
            plays: Number(d.plays || 0),
          })),
          total_events: totalEvents,
          period_days: days,
        });
      }

      case 'financial': {
        // Busca rates de cada partner via partner_payments
        const partnerPayments = isSuperAdmin
          ? await sql`SELECT pp.partner_id, pp.hourly_rate, pp.monthly_rate, pp.currency, pa.display_name, pa.username, pp.organization_id FROM partner_payments pp LEFT JOIN partner_access pa ON pa.id = pp.partner_id`
          : await sql`SELECT pp.partner_id, pp.hourly_rate, pp.monthly_rate, pp.currency, pa.display_name, pa.username, pp.organization_id FROM partner_payments pp LEFT JOIN partner_access pa ON pa.id = pp.partner_id WHERE pp.organization_id = ${orgId}`;

        // Calcula horas de uptime por partner_devices → partner_access
        const uptimeData = isSuperAdmin
          ? await sql`
            SELECT pd.partner_access_id, pd.device_id, dus.started_at, dus.ended_at,
                   o.name as org_name, o.id as org_id
            FROM device_uptime_sessions dus
            LEFT JOIN devices d ON d.id = dus.device_id
            LEFT JOIN partner_devices pd ON pd.device_id = dus.device_id
            LEFT JOIN organizations o ON o.id = dus.organization_id
            WHERE dus.started_at >= ${startDate.toISOString()}
          `
          : await sql`
            SELECT pd.partner_access_id, pd.device_id, dus.started_at, dus.ended_at,
                   o.name as org_name, o.id as org_id
            FROM device_uptime_sessions dus
            LEFT JOIN devices d ON d.id = dus.device_id
            LEFT JOIN partner_devices pd ON pd.device_id = dus.device_id
            LEFT JOIN organizations o ON o.id = dus.organization_id
            WHERE dus.started_at >= ${startDate.toISOString()}
              AND dus.organization_id = ${orgId}
          `;

        // Agrega por partner_access_id
        type PartnerStats = {
          hours: number;
          devices: Set<string>;
          org_name: string;
          org_id: string;
          partner_name: string;
          partner_username: string;
        };
        const statsMap: Record<string, PartnerStats> = {};

        for (const s of uptimeData) {
          if (!s.partner_access_id) continue;
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          const hours = (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
          if (!statsMap[s.partner_access_id]) {
            statsMap[s.partner_access_id] = {
              hours: 0, devices: new Set(), org_name: s.org_name || 'Sem org',
              org_id: s.org_id || '', partner_name: s.display_name || s.username || 'Sem nome',
              partner_username: s.username || '',
            };
          }
          statsMap[s.partner_access_id].hours += hours;
          statsMap[s.partner_access_id].devices.add(s.device_id);
        }

        // Monta rates map: partner_id → rate
        const ratesMap: Record<string, { hourly_rate: number; monthly_rate: number; currency: string }> = {};
        for (const p of partnerPayments) {
          ratesMap[p.partner_id] = {
            hourly_rate: Number(p.hourly_rate || 0),
            monthly_rate: Number(p.monthly_rate || 0),
            currency: p.currency || 'BRL',
          };
        }

        // Para partners sem rate configurado, usa padrão
        const DEFAULT_HOURLY = 0.50;
        const DEFAULT_MONTHLY = 0;

        let totalHours = 0;
        let totalAmount = 0;

        const partners = Object.entries(statsMap).map(([partnerId, stats]) => {
          const rates = ratesMap[partnerId] || { hourly_rate: DEFAULT_HOURLY, monthly_rate: DEFAULT_MONTHLY, currency: 'BRL' };
          const paymentType = rates.monthly_rate > 0 ? 'monthly' : 'hourly';
          const estimatedAmount = paymentType === 'monthly'
            ? rates.monthly_rate
            : stats.hours * rates.hourly_rate;

          totalHours += stats.hours;
          totalAmount += estimatedAmount;

          return {
            partner_id: partnerId,
            partner_name: stats.partner_name,
            partner_username: stats.partner_username,
            org_name: stats.org_name,
            payment_type: paymentType,
            devices_count: stats.devices.size,
            hours: Math.round(stats.hours * 100) / 100,
            hourly_rate: rates.hourly_rate,
            monthly_rate: rates.monthly_rate,
            currency: rates.currency,
            estimated_amount: Math.round(estimatedAmount * 100) / 100,
          };
        }).sort((a, b) => b.estimated_amount - a.estimated_amount);

        return NextResponse.json({
          partners,
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
