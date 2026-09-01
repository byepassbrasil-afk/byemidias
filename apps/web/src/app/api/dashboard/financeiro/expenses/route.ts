import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/financeiro/expenses — List expenses for the org
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    let expenses;
    if (user.role === 'super_admin') {
      expenses = await sql`
        SELECT e.*, p.full_name as creator_name, o.name as organization_name
        FROM expenses e
        LEFT JOIN profiles p ON p.id = e.created_by
        LEFT JOIN organizations o ON o.id = e.organization_id
        ORDER BY e.date DESC, e.created_at DESC
      `;
    } else {
      expenses = await sql`
        SELECT e.*, p.full_name as creator_name, o.name as organization_name
        FROM expenses e
        LEFT JOIN profiles p ON p.id = e.created_by
        LEFT JOIN organizations o ON o.id = e.organization_id
        WHERE e.organization_id = ${user.organization_id}
        ORDER BY e.date DESC, e.created_at DESC
      `;
    }
    return NextResponse.json({ expenses: expenses ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/financeiro/expenses — Create new expense
export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { category, description, amount, currency, date, recurring, recurrence_period, notes } = body;
    if (!category || !amount) {
      return NextResponse.json({ error: 'category e amount obrigatórios' }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO expenses (
        organization_id, category, description, amount, currency, date,
        recurring, recurrence_period, notes, created_by
      )
      VALUES (
        ${user.organization_id}, ${category}, ${description || null},
        ${Number(amount)}, ${currency || 'BRL'},
        ${date || new Date().toISOString().split('T')[0]},
        ${recurring || false}, ${recurrence_period || null},
        ${notes || null}, ${user.id}
      )
      RETURNING *
    `;
    return NextResponse.json({ expense: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
