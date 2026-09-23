import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


// PUT /api/dashboard/categories/[id] — update local category
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

    // Verifica que a categoria é da org do user (ou é global mas user é super_admin)
    const [existing] = await sql`SELECT organization_id, is_default FROM categories WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    if (existing.organization_id !== null && existing.organization_id !== user.organization_id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Não permite editar/renomear "Padrão" — campos bloqueados
    if (existing.is_default && user.role !== 'super_admin') {
      // Org admin pode editar descrição/cor mas não nome/slug
      const { name, slug, is_default } = body;
      if (name || slug || is_default !== undefined) {
        return NextResponse.json({ error: 'Categoria "Padrão" não pode ter nome/slug alterados' }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color !== undefined) updates.color = body.color;
    if (body.description !== undefined) updates.description = body.description;
    updates.updated_at = new Date();

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    const values = Object.values(updates);
    values.push(id);
    const valuesTyped = values as (string | number | boolean | null)[];

    const [category] = await sql.unsafe(
      `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${valuesTyped.length} RETURNING *`,
      valuesTyped
    );

    return NextResponse.json({ category });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/dashboard/categories/[id] — delete local category
export async function DELETE(
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

    const [existing] = await sql`SELECT organization_id, is_default FROM categories WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    if (existing.organization_id !== null && existing.organization_id !== user.organization_id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Não permite excluir "Padrão"
    if (existing.is_default) {
      return NextResponse.json({ error: 'Categoria "Padrão" não pode ser excluída' }, { status: 400 });
    }

    // Verifica se há mídias ou devices vinculados
    const [usage] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM media_categories WHERE category_id = ${id}) as media_count,
        (SELECT COUNT(*)::int FROM device_categories WHERE category_id = ${id}) as device_count,
        (SELECT COUNT(*)::int FROM partner_access WHERE category_id = ${id}) as partner_count
    `;
    if (usage.media_count > 0 || usage.device_count > 0 || usage.partner_count > 0) {
      return NextResponse.json({
        error: `Categoria em uso: ${usage.media_count} mídias, ${usage.device_count} devices, ${usage.partner_count} parceiros. Remova as vinculações antes.`,
      }, { status: 400 });
    }

    await sql`DELETE FROM categories WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
