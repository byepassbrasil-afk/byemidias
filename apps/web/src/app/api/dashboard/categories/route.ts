import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

function serialize(category: any) {
  return {
    id: category.id,
    organization_id: category.organization_id || null,
    name: category.name,
    slug: category.slug,
    icon: category.icon || '🏷️',
    color: category.color || '#ee6a1e',
    description: category.description || null,
    is_default: !!category.is_default,
    is_global: !category.organization_id,
    media_count: Number(category.media_count || 0),
    device_count: Number(category.device_count || 0),
  };
}

export async function GET() {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  try {
    const pb = await getAdminClient();
    const filter = user.role === 'super_admin' ? '' : `organization_id = "${user.organization_id}"`;
    const local = await pb.collection('categories').getFullList({ filter, sort: 'name' });
    const global = user.role === 'super_admin' ? [] : await pb.collection('categories').getFullList({ filter: 'organization_id = ""', sort: 'name' });
    return NextResponse.json({ categories: [...global, ...local].map(serialize) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao listar categorias' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  if (!user.organization_id) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 });

  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (name.length < 2) return NextResponse.json({ error: 'Nome obrigatório (mín 2 caracteres)' }, { status: 400 });
    const slug = slugify(body.slug || name);
    if (!slug) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });

    const pb = await getAdminClient();
    const existing = await pb.collection('categories').getFirstListItem(`organization_id = "${user.organization_id}" && slug = "${slug}"`).catch(() => null);
    if (existing) return NextResponse.json({ error: 'Já existe uma categoria com este slug' }, { status: 409 });

    const category = await pb.collection('categories').create({
      organization_id: user.organization_id,
      name,
      slug,
      icon: body.icon || '🏷️',
      color: body.color || '#ee6a1e',
      description: body.description || null,
      is_default: false,
    });
    return NextResponse.json({ category: serialize(category) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao criar categoria' }, { status: 500 });
  }
}
