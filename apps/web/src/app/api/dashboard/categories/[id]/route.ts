import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

async function getCategory(id: string) {
  const pb = await getAdminClient();
  return { pb, category: await pb.collection('categories').getOne(id) };
}

function canEdit(category: any, user: any) {
  return user.role === 'super_admin' || !category.organization_id || category.organization_id === user.organization_id;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  try {
    const { id } = await params;
    const { pb, category } = await getCategory(id);
    if (!canEdit(category, user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (category.is_default && user.role !== 'super_admin') return NextResponse.json({ error: 'Categoria Padrão não pode ser alterada' }, { status: 400 });
    const body = await request.json();
    const updates: any = {};
    for (const key of ['name', 'icon', 'color', 'description']) if (body[key] !== undefined) updates[key] = body[key];
    const updated = await pb.collection('categories').update(id, updates);
    return NextResponse.json({ category: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar categoria' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  try {
    const { id } = await params;
    const { pb, category } = await getCategory(id);
    if (!canEdit(category, user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (category.is_default) return NextResponse.json({ error: 'Categoria Padrão não pode ser excluída' }, { status: 400 });
    await pb.collection('categories').delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao excluir categoria' }, { status: 500 });
  }
}
