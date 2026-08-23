import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/device-groups/assign - Assign campaign to group devices
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();
    const { group_id, campaign_id } = body;

    if (!group_id) {
      return NextResponse.json({ error: 'group_id obrigatório' }, { status: 400 });
    }

    // Get group members
    const { data: members, error: memErr } = await supabase
      .from('device_group_members')
      .select('device_id')
      .eq('group_id', group_id);

    if (memErr) throw memErr;

    if (!members?.length) {
      return NextResponse.json({ error: 'Grupo sem dispositivos' }, { status: 400 });
    }

    // Update all devices in group
    const deviceIds = members.map(m => m.device_id);
    const { error: updateErr } = await supabase
      .from('devices')
      .update({ campaign_id: campaign_id || null })
      .in('id', deviceIds);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, updated: deviceIds.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
