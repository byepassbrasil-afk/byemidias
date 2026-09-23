import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/media/[id]/categories — list media's categories
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [media] = await sql`SELECT organization_id FROM media WHERE id = ${id}`;
    if (!media) return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 });
    if (user.role !== 'super_admin' && media.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const categories = await sql`
      SELECT
        mc.category_id, mc.created_at,
        c.name, c.slug, c.icon, c.color, c.description, c.is_default,
        (c.organization_id IS NULL) AS is_global
      FROM media_categories mc
      INNER JOIN categories c ON c.id = mc.category_id
      WHERE mc.media_id = ${id}
      ORDER BY c.is_default DESC, c.name
    `;

    return NextResponse.json({ categories });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/dashboard/media/[id]/categories — set media categories (bulk)
// Body: { category_ids: ["uuid", ...] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const categoryIds: string[] = body.category_ids ?? [];

    const [media] = await sql`SELECT organization_id FROM media WHERE id = ${id}`;
    if (!media) return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 });
    if (user.role !== 'super_admin' && media.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Valida categorias
    if (categoryIds.length > 0) {
      const cats = await sql`
        SELECT id, organization_id FROM categories WHERE id = ANY(${categoryIds})
      `;
      for (const cat of cats) {
        if (cat.organization_id !== null && cat.organization_id !== media.organization_id) {
          return NextResponse.json({ error: 'Categoria não pertence à org' }, { status: 400 });
        }
      }
    }

    // Substitui vinculações
    await sql`DELETE FROM media_categories WHERE media_id = ${id}`;

    for (const catId of categoryIds) {
      await sql`
        INSERT INTO media_categories (media_id, category_id)
        VALUES (${id}, ${catId})
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({ success: true, count: categoryIds.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
