import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/device-groups
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = supabase
      .from('device_groups')
      .select(`
        *,
        device_group_members (
          id,
          device_id,
          devices (name, status, campaign_id)
        )
      `)
      .order('name');

    if (orgId) query = query.eq('organization_id', orgId);

    const { data: groups, error } = await query;
    if (error) throw error;

    return NextResponse.json({ groups: groups || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/device-groups
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();
    const { name, description, device_ids, organization_id } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    let orgId = organization_id;
    if (!orgId) {
      const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      orgId = orgs?.[0]?.id;
    }

    // Create group
    const { data: group, error: groupErr } = await supabase
      .from('device_groups')
      .insert({ organization_id: orgId, name, description: description || null })
      .select()
      .single();

    if (groupErr) throw groupErr;

    // Add devices to group
    if (device_ids?.length > 0) {
      const members = device_ids.map((deviceId: string) => ({
        group_id: group.id,
        device_id: deviceId,
      }));
      const { error: memberErr } = await supabase
        .from('device_group_members')
        .insert(members);

      if (memberErr) throw memberErr;
    }

    return NextResponse.json({ group });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/device-groups (update members)
export async function PUT(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();
    const { group_id, device_ids } = body;

    if (!group_id) {
      return NextResponse.json({ error: 'group_id obrigatório' }, { status: 400 });
    }

    // Remove existing members
    await supabase.from('device_group_members').delete().eq('group_id', group_id);

    // Add new members
    if (device_ids?.length > 0) {
      const members = device_ids.map((deviceId: string) => ({
        group_id,
        device_id: deviceId,
      }));
      const { error } = await supabase.from('device_group_members').insert(members);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/device-groups?id=X
export async function DELETE(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Members deleted via CASCADE
    const { error } = await supabase.from('device_groups').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
