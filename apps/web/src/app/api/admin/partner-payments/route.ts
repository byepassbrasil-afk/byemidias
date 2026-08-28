import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/admin/partner-payments — list all partner payment configs
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const isSuperAdmin = user.role === 'super_admin';

    // Get partner payments with partner info
    const payments = isSuperAdmin
      ? await sql`
        SELECT pp.*, pa.display_name, pa.username, o.name as org_name
        FROM partner_payments pp
        LEFT JOIN partner_access pa ON pa.id = pp.partner_id
        LEFT JOIN organizations o ON o.id = pp.organization_id
        ORDER BY o.name ASC, pa.username ASC
      `
      : await sql`
        SELECT pp.*, pa.display_name, pa.username, o.name as org_name
        FROM partner_payments pp
        LEFT JOIN partner_access pa ON pa.id = pp.partner_id
        LEFT JOIN organizations o ON o.id = pp.organization_id
        WHERE pp.organization_id = ${user.organization_id}
        ORDER BY pa.username ASC
      `;

    return NextResponse.json({ payments: payments ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/partner-payments — upsert (update or insert) partner payment config
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { partner_id, hourly_rate, monthly_rate, currency } = body;

    if (!partner_id) return NextResponse.json({ error: 'partner_id obrigatório' }, { status: 400 });

    // Get org_id for this partner
    const [partner] = await sql`SELECT organization_id FROM partner_access WHERE id = ${partner_id}`;
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });

    const isSuper = user.role === 'super_admin';
    // Upsert: update if exists, insert if not
    const orgId = isSuper ? (partner.organization_id || user.organization_id) : user.organization_id;

    const [existing] = await sql`SELECT id FROM partner_payments WHERE partner_id = ${partner_id}`;

    if (existing) {
      const [updated] = await sql`
        UPDATE partner_payments
        SET hourly_rate = ${hourly_rate ?? 0}, monthly_rate = ${monthly_rate ?? 0}, currency = ${currency ?? 'BRL'}
        WHERE partner_id = ${partner_id}
        RETURNING *
      `;
      return NextResponse.json({ payment: updated });
    } else {
      const [created] = await sql`
        INSERT INTO partner_payments (partner_id, organization_id, hourly_rate, monthly_rate, currency)
        VALUES (${partner_id}, ${orgId}, ${hourly_rate ?? 0}, ${monthly_rate ?? 0}, ${currency ?? 'BRL'})
        RETURNING *
      `;
      return NextResponse.json({ payment: created });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
