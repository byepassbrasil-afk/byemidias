import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/uptime?device_id=X&days=30&partner_id=X
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const partnerId = searchParams.get('partner_id');
    const days = parseInt(searchParams.get('days') || '30');
    const orgId = searchParams.get('org_id');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Close stale sessions first
    await supabase.rpc('close_stale_uptime_sessions');

    // Get uptime sessions
    let query = supabase
      .from('device_uptime_sessions')
      .select('*, devices(name, model)')
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false });

    if (deviceId) query = query.eq('device_id', deviceId);
    if (partnerId) query = query.eq('partner_id', partnerId);
    if (orgId) query = query.eq('organization_id', orgId);

    const { data: sessions, error } = await query;
    if (error) throw error;

    // Calculate daily uptime per device
    const dailyUptime: Record<string, Record<string, number>> = {};

    for (const session of sessions || []) {
      const deviceName = (session.devices as Record<string, string>)?.name || session.device_id;
      const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
      const durationHours = (endedAt.getTime() - new Date(session.started_at).getTime()) / (1000 * 60 * 60);

      // Get date key
      const dateKey = new Date(session.started_at).toISOString().split('T')[0];

      if (!dailyUptime[deviceName]) dailyUptime[deviceName] = {};
      dailyUptime[deviceName][dateKey] = (dailyUptime[deviceName][dateKey] || 0) + durationHours;
    }

    // Calculate totals per device
    const deviceSummaries = Object.entries(dailyUptime).map(([device, days]) => {
      const totalHours = Object.values(days).reduce((sum, h) => sum + h, 0);
      return {
        device,
        total_hours: Math.round(totalHours * 100) / 100,
        days_online: Object.keys(days).length,
        daily: days,
      };
    });

    // Get partner payment settings
    const { data: payments } = await supabase
      .from('partner_payments')
      .select('*')
      .eq('is_active', true);

    return NextResponse.json({
      sessions: sessions || [],
      summaries: deviceSummaries,
      payments: payments || [],
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/uptime - Create/update partner payment settings
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { partner_id, organization_id, payment_type, hourly_rate, monthly_rate } = body;

    if (!partner_id || !organization_id) {
      return NextResponse.json({ error: 'partner_id e organization_id obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('partner_payments')
      .upsert({
        partner_id,
        organization_id,
        payment_type: payment_type || 'hourly',
        hourly_rate: hourly_rate || 0,
        monthly_rate: monthly_rate || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'partner_id,organization_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ payment: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
