import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// PUT /api/dashboard/advertisers/[id]/invoices/[inv_id]
export async function PUT(request: NextRequest, { params }: { params: { id: string; inv_id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { inv_id } = params;
    const body = await request.json();
    const { status, amount, due_date, period_start, period_end } = body;

    const [updated] = await sql`
      UPDATE advertiser_invoices SET
        status = COALESCE(${status}, status),
        amount = COALESCE(${amount}, amount),
        due_date = COALESCE(${due_date}, due_date),
        period_start = COALESCE(${period_start}, period_start),
        period_end = COALESCE(${period_end}, period_end)
      WHERE id = ${inv_id}
      RETURNING *
    `;

    if (!updated) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    return NextResponse.json({ invoice: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
