import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/admin/invoices
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const isSuperAdmin = user.role === 'super_admin';

    const invoices = isSuperAdmin
      ? await sql`
        SELECT pi.*, pa.display_name, pa.username
        FROM partner_invoices pi
        LEFT JOIN partner_access pa ON pa.id = pi.partner_id
        ORDER BY pi.created_at DESC
      `
      : await sql`
        SELECT pi.*, pa.display_name, pa.username
        FROM partner_invoices pi
        LEFT JOIN partner_access pa ON pa.id = pi.partner_id
        WHERE pi.organization_id = ${user.organization_id}
        ORDER BY pi.created_at DESC
      `;

    return NextResponse.json({
      invoices: (invoices ?? []).map((inv: Record<string, unknown>) => ({
        ...inv,
        partner_name: (inv.display_name as string) ?? (inv.username as string) ?? 'Sem nome',
        total_hours: Number(inv.total_hours || 0),
        total_amount: Number(inv.total_amount || 0),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/invoices — generate invoice for a partner for a given period
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { partner_id, period_start } = body;

    if (!partner_id || !period_start) {
      return NextResponse.json({ error: 'partner_id e period_start obrigatórios' }, { status: 400 });
    }

    // Get partner info and org
    const [partner] = await sql`SELECT pa.*, o.name as org_name, o.id as org_id FROM partner_access pa LEFT JOIN organizations o ON o.id = pa.organization_id WHERE pa.id = ${partner_id}`;
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });

    // Calculate period_end (end of that month)
    const start = new Date(period_start + 'T00:00:00Z');
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    // Get uptime sessions for this partner in the period
    const uptimeSessions = await sql`
      SELECT dus.started_at, dus.ended_at
      FROM device_uptime_sessions dus
      LEFT JOIN partner_devices pd ON pd.device_id = dus.device_id
      WHERE pd.partner_access_id = ${partner_id}
        AND dus.started_at >= ${start.toISOString()}
        AND dus.started_at < ${end.toISOString()}
    `;

    // Calculate total hours
    let totalHours = 0;
    for (const s of uptimeSessions) {
      const ended = s.ended_at ? new Date(s.ended_at) : new Date();
      const hours = (ended.getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60);
      totalHours += hours;
    }

    // Get payment rate
    const [payment] = await sql`SELECT hourly_rate, monthly_rate FROM partner_payments WHERE partner_id = ${partner_id}`;
    const hourlyRate = Number(payment?.hourly_rate || 0.5);
    const monthlyRate = Number(payment?.monthly_rate || 0);

    // Calculate amount
    const totalAmount = monthlyRate > 0 ? monthlyRate : totalHours * hourlyRate;

    // Create invoice
    const [invoice] = await sql`
      INSERT INTO partner_invoices (partner_id, organization_id, period_start, period_end, total_hours, total_amount, status)
      VALUES (
        ${partner_id},
        ${partner.org_id || user.organization_id},
        ${start.toISOString().split('T')[0]},
        ${end.toISOString().split('T')[0]},
        ${Math.round(totalHours * 100) / 100},
        ${Math.round(totalAmount * 100) / 100},
        'draft'
      )
      RETURNING *
    `;

    return NextResponse.json({ invoice });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/invoices — update status
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !['draft', 'sent', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE partner_invoices SET status = ${status} WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ invoice: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
