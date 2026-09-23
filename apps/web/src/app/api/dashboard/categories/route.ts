import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/categories — list categories available to this org (local + global)
export async function GET(_request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    // Lista: globais (organization_id IS NULL) + da própria org
    const categories = await sql`
      SELECT
        c.id, c.organization_id, c.name, c.slug, c.icon, c.color,
        c.description, c.is_default, c.created_at, c.updated_at,
        (c.organization_id IS NULL) AS is_global,
        (SELECT COUNT(*)::int FROM media_categories mc WHERE mc.category_id = c.id) AS media_count,
        (SELECT COUNT(*)::int FROM device_categories dc WHERE dc.category_id = c.id) AS device_count
      FROM categories c
      WHERE c.organization_id IS NULL
         OR c.organization_id = ${user.role === 'super_admin' ? sql`c.organization_id` : user.organization_id}
      ORDER BY c.is_default DESC, c.organization_id NULLS FIRST, c.name
    `;

    return NextResponse.json({ categories });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/categories — create local category
export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  if (!user.organization_id) {
    return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, slug, icon, color, description } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome obrigatório (mín 2 caracteres)' }, { status: 400 });
    }

    // Auto-gerar slug se não informado
    const finalSlug = (slug || name)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    if (!finalSlug) {
      return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });
    }

    const [category] = await sql`
      INSERT INTO categories (organization_id, name, slug, icon, color, description)
      VALUES (
        ${user.organization_id},
        ${name.trim()},
        ${finalSlug},
        ${icon || '🏷️'},
        ${color || '#6b7280'},
        ${description || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ category });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Já existe uma categoria com este slug' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

