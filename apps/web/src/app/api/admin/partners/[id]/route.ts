import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAuthApi();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const [profile] = await sql`SELECT organization_id, role FROM profiles WHERE id = ${user.id}`;

  if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
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

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true });
  }

  if (profile.role !== 'super_admin' && profile.organization_id) {
    await sql`UPDATE partner_access SET ${sql(updateData)} WHERE id = ${params.id} AND organization_id = ${profile.organization_id}`;
  } else {
    await sql`UPDATE partner_access SET ${sql(updateData)} WHERE id = ${params.id}`;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAuthApi();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const [profile] = await sql`SELECT organization_id, role FROM profiles WHERE id = ${user.id}`;

  if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  await sql`DELETE FROM partner_devices WHERE partner_access_id = ${params.id}`;

  if (profile.role !== 'super_admin' && profile.organization_id) {
    await sql`DELETE FROM partner_access WHERE id = ${params.id} AND organization_id = ${profile.organization_id}`;
  } else {
    await sql`DELETE FROM partner_access WHERE id = ${params.id}`;
  }

  return NextResponse.json({ success: true });
}
