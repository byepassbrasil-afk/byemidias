import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/admin/contract-templates — List templates for the org
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let templates;
    if (user.role === 'super_admin') {
      templates = await sql`
        SELECT ct.*, o.name as organization_name, p.full_name as creator_name
        FROM contract_templates ct
        LEFT JOIN organizations o ON o.id = ct.organization_id
        LEFT JOIN profiles p ON p.id = ct.created_by
        ${status ? sql`WHERE ct.status = ${status}` : sql``}
        ORDER BY ct.created_at DESC
      `;
    } else {
      templates = await sql`
        SELECT ct.*, o.name as organization_name, p.full_name as creator_name
        FROM contract_templates ct
        LEFT JOIN organizations o ON o.id = ct.organization_id
        LEFT JOIN profiles p ON p.id = ct.created_by
        WHERE ct.organization_id = ${user.organization_id}
        ${status ? sql`AND ct.status = ${status}` : sql``}
        ORDER BY ct.created_at DESC
      `;
    }

    return NextResponse.json({ templates: templates ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/contract-templates — Create template
export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { organization_id, name, duration_months, monthly_fee, hourly_fee, bonus_structure, custom_clauses } = body;

    if (!organization_id || !name) {
      return NextResponse.json({ error: 'organization_id e name obrigatórios' }, { status: 400 });
    }

    if (user.role !== 'super_admin' && organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão para outra org' }, { status: 403 });
    }

    const [created] = await sql`
      INSERT INTO contract_templates (
        organization_id, name, duration_months, monthly_fee, hourly_fee,
        bonus_structure, custom_clauses, status, created_by
      )
      VALUES (
        ${organization_id}, ${name}, ${duration_months || null},
        ${monthly_fee || 0}, ${hourly_fee || 0},
        ${bonus_structure ? JSON.stringify(bonus_structure) : null}::jsonb,
        ${custom_clauses || null}, 'active', ${user.id}
      )
      RETURNING *
    `;

    return NextResponse.json({ template: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
