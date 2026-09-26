import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const pb = await getAdminClient();
    const existing = await pb.collection('partner_access').getOne(id);
    if (user.role !== 'super_admin' && existing.organization_id !== user.organization_id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const updates: any = {};
    for (const key of ['status', 'display_name', 'email', 'category_id', 'role']) if (body[key] !== undefined) updates[key] = body[key];
    if (body.password) {
      const bcrypt = await import('bcryptjs');
      updates.password_hash = await bcrypt.hash(String(body.password), 10);
    }
    const partner = await pb.collection('partner_access').update(id, updates);
    return NextResponse.json({ success: true, partner });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar parceiro' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  try {
    const pb = await getAdminClient();
    const existing = await pb.collection('partner_access').getOne(id);
    if (user.role !== 'super_admin' && existing.organization_id !== user.organization_id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const links = await pb.collection('partner_devices').getFullList({ filter: `partner_access_id = "${id}"` });
    for (const link of links.items) await pb.collection('partner_devices').delete(link.id);
    await pb.collection('partner_access').delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao excluir parceiro' }, { status: 500 });
  }
}
