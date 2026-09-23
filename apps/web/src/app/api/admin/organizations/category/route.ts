import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


export async function PUT(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await request.json();
    const { organization_id, category_id } = body;

    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    // Authorization: super_admin pode editar qualquer org. Outros só podem editar a própria.
    if (user.role !== 'super_admin' && user.organization_id !== organization_id) {
      return NextResponse.json({
        error: 'Você só pode editar a categoria da sua própria organização.'
      }, { status: 403 });
    }

    // Validate category exists (if provided)
    if (category_id) {
      const [cat] = await sql`SELECT id FROM categories WHERE id = ${category_id} LIMIT 1`;
      if (!cat) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    await sql`
      UPDATE organizations SET category_id = ${category_id || null}, updated_at = NOW()
      WHERE id = ${organization_id}
    `;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

