import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { partner_id, devices } = await request.json();

    if (!partner_id || !Array.isArray(devices)) {
      return NextResponse.json({ error: 'partner_id e devices obrigatórios' }, { status: 400 });
    }

    // Verify partner exists (super_admin sees all, admin only sees their org)
    let partnerQuery = supabase.from('partner_access').select('id').eq('id', partner_id);
    if (profile.role !== 'super_admin' && profile.organization_id) {
      partnerQuery = partnerQuery.eq('organization_id', profile.organization_id);
    }
    const { data: partner } = await partnerQuery.single();

    if (!partner) {
      return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    // Delete existing assignments
    await supabase.from('partner_devices').delete().eq('partner_access_id', partner_id);

    // Insert new assignments
    if (devices.length > 0) {
      const assignments = devices.map((d: { device_id: string; playlist_id?: string }) => ({
        partner_access_id: partner_id,
        device_id: d.device_id,
        playlist_id: d.playlist_id || null,
      }));

      const { error } = await supabase.from('partner_devices').insert(assignments);

      if (error) {
        console.error('Insert partner_devices error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('PUT /api/admin/partners/devices error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
