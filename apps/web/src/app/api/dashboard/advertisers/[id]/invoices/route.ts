import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/advertisers/[id]/invoices
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const invoices = await sql`
      SELECT * FROM advertiser_invoices
      WHERE advertiser_id = ${id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ invoices });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/advertisers/[id]/invoices
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { period_start, period_end, amount, due_date } = body;

    if (!period_start || amount === undefined) {
      return NextResponse.json({ error: 'period_start e amount obrigatórios' }, { status: 400 });
    }

    // Get org_id
    const [adv] = await sql`SELECT organization_id FROM advertisers WHERE id = ${id}`;
    if (!adv) return NextResponse.json({ error: 'Anunciante não encontrado' }, { status: 404 });

    const [invoice] = await sql`
      INSERT INTO advertiser_invoices (advertiser_id, organization_id, period_start, period_end, amount, status, due_date)
      VALUES (${id}, ${adv.organization_id}, ${period_start}, ${period_end || null}, ${amount}, 'draft', ${due_date || null})
      RETURNING *
    `;

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
