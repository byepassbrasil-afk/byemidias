import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAuthApi } from '@/lib/auth';

// Update partner (status, display_name)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAuthApi();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const { display_name, status, password } = await request.json();

  const updateData: Record<string, unknown> = {};
  if (display_name) updateData.display_name = display_name.trim();
  if (status) updateData.status = status;

  if (password) {
    const bcrypt = await import('bcryptjs');
    updateData.password_hash = await bcrypt.hash(password, 10);
  }

  let query = supabase
    .from('partner_access')
    .update(updateData)
    .eq('id', params.id);

  if (profile.role !== 'super_admin' && profile.organization_id) {
    query = query.eq('organization_id', profile.organization_id);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Delete partner
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAuthApi();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  // Delete partner devices first
  await supabase.from('partner_devices').delete().eq('partner_access_id', params.id);

  let deleteQuery = supabase
    .from('partner_access')
    .delete()
    .eq('id', params.id);

  if (profile.role !== 'super_admin' && profile.organization_id) {
    deleteQuery = deleteQuery.eq('organization_id', profile.organization_id);
  }

  const { error } = await deleteQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
