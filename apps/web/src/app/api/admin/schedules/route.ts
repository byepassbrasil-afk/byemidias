import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/schedules
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = supabase
      .from('content_schedules')
      .select('*, campaigns(name), playlists(name)')
      .order('priority', { ascending: false });

    if (orgId) query = query.eq('organization_id', orgId);

    const { data: schedules, error } = await query;
    if (error) throw error;

    // Get groups
    let groupQuery = supabase
      .from('device_groups')
      .select('*, device_group_members(count)')
      .order('name');

    if (orgId) groupQuery = groupQuery.eq('organization_id', orgId);

    const { data: groups } = await groupQuery;

    return NextResponse.json({ schedules: schedules || [], groups: groups || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/schedules
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { name, description, campaign_id, playlist_id, sync_type, sync_interval_minutes, sync_days, sync_start_time, sync_end_time, organization_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    let orgId = organization_id;
    if (!orgId) {
      const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      orgId = orgs?.[0]?.id;
    }

    const { data, error } = await supabase
      .from('content_schedules')
      .insert({
        organization_id: orgId,
        name,
        description: description || null,
        campaign_id: campaign_id || null,
        playlist_id: playlist_id || null,
        sync_type: sync_type || 'periodic',
        sync_interval_minutes: sync_interval_minutes || 15,
        sync_days: sync_days || '{1,2,3,4,5,6,7}',
        sync_start_time: sync_start_time || '00:00',
        sync_end_time: sync_end_time || '23:59',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ schedule: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/schedules?id=X
export async function DELETE(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const { error } = await supabase.from('content_schedules').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
