import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/financeiro/revenues — List revenues for the org
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    let revenues;
    if (user.role === 'super_admin') {
      const revenues = await sql`
        SELECT r.*, p.full_name as creator_name, o.name as organization_name,
               pa.display_name as partner_name,
               c.name as campaign_name
        FROM revenues r
        LEFT JOIN profiles p ON p.id = r.created_by
        LEFT JOIN organizations o ON o.id = r.organization_id
        LEFT JOIN partner_access pa ON pa.id = r.partner_id
        LEFT JOIN campaigns c ON c.id = r.campaign_id
        ORDER BY r.date DESC, r.created_at DESC
      `;
    } else {
      revenues = await sql`
        SELECT r.*, p.full_name as creator_name, o.name as organization_name,
               pa.display_name as partner_name,
               c.name as campaign_name
        FROM revenues r
        LEFT JOIN profiles p ON p.id = r.created_by
        LEFT JOIN organizations o ON o.id = r.organization_id
        LEFT JOIN partner_access pa ON pa.id = r.partner_id
        LEFT JOIN campaigns c ON c.id = r.campaign_id
        WHERE r.organization_id = ${user.organization_id}
        ORDER BY r.date DESC, r.created_at DESC
      `;
    }
    return NextResponse.json({ revenues: revenues ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/financeiro/revenues — Create manual revenue entry
export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { source, source_id, category, description, amount, currency, date, partner_id, campaign_id, notes } = body;
    if (!source || !amount) {
      return NextResponse.json({ error: 'source e amount obrigatórios' }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO revenues (
        organization_id, source, source_id, category, description, amount,
        currency, date, partner_id, campaign_id, notes, created_by
      )
      VALUES (
        ${user.organization_id}, ${source}, ${source_id || null},
        ${category || null}, ${description || null},
        ${Number(amount)}, ${currency || 'BRL'},
        ${date || new Date().toISOString().split('T')[0]},
        ${partner_id || null}, ${campaign_id || null},
        ${notes || null}, ${user.id}
      )
      RETURNING *
    `;
    return NextResponse.json({ revenue: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
