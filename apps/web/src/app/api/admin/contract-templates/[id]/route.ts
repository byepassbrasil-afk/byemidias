import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// PUT /api/admin/contract-templates/[id] — Edit template
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, duration_months, monthly_fee, hourly_fee, bonus_structure, custom_clauses, status } = body;

    if (user.role !== 'super_admin') {
      const [own] = await sql`SELECT organization_id FROM contract_templates WHERE id = ${id}`;
      if (!own || own.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    const [updated] = await sql`
      UPDATE contract_templates SET
        name = COALESCE(${name}, name),
        duration_months = COALESCE(${duration_months}, duration_months),
        monthly_fee = COALESCE(${monthly_fee}, monthly_fee),
        hourly_fee = COALESCE(${hourly_fee}, hourly_fee),
        bonus_structure = COALESCE(${bonus_structure ? JSON.stringify(bonus_structure) : null}::jsonb, bonus_structure),
        custom_clauses = COALESCE(${custom_clauses}, custom_clauses),
        status = COALESCE(${status}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ template: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/contract-templates/[id] — Archive template (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (user.role !== 'super_admin') {
      const [own] = await sql`SELECT organization_id FROM contract_templates WHERE id = ${id}`;
      if (!own || own.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    const [updated] = await sql`
      UPDATE contract_templates SET status = 'archived', updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ template: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
