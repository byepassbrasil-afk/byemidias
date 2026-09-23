import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// POST /api/dashboard/categories/ensure-defaults — Run helper to ensure all orgs have Padrão
// Admin/maintenance endpoint - one-off fix
export async function POST(_request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super_admin' }, { status: 403 });
  }

  try {
    // Find orgs without Padrão category
    const orgsWithoutPadrao = await sql`
      SELECT o.id, o.name FROM organizations o
      WHERE NOT EXISTS (
        SELECT 1 FROM categories c
        WHERE c.organization_id = o.id AND c.is_default = TRUE
      )
    `;

    if (orgsWithoutPadrao.length === 0) {
      return NextResponse.json({ message: 'Todas as orgs já têm Padrão', created: 0 });
    }

    // Create Padrão for each missing org
    for (const org of orgsWithoutPadrao) {
      await sql`
        INSERT INTO categories (organization_id, name, slug, icon, color, is_default, description)
        VALUES (
          ${org.id},
          'Padrão',
          'padrao-' || LOWER(REPLACE(${org.id}::text, '-', '')),
          '🏷️',
          '#6b7280',
          TRUE,
          'Categoria padrão da organização (helper auto)'
        )
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({
      message: 'Padrão categories created',
      created: orgsWithoutPadrao.length,
      orgs: orgsWithoutPadrao.map((o: any) => ({ id: o.id, name: o.name })),
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

