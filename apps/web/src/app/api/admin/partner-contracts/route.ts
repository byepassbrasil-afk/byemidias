import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';
import { generateContractPdf } from '@/lib/pdf-contract';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// GET /api/admin/partner-contracts — List contracts
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partner_id');
    const expiringSoon = searchParams.get('expiring_soon') === 'true';

    let query;
    if (user.role === 'super_admin') {
      query = sql`
        SELECT pc.*, pa.username as partner_username, pa.display_name as partner_name,
               ct.name as template_name, o.name as organization_name
        FROM partner_contracts pc
        LEFT JOIN partner_access pa ON pa.id = pc.partner_id
        LEFT JOIN contract_templates ct ON ct.id = pc.template_id
        LEFT JOIN organizations o ON o.id = pc.organization_id
        WHERE 1=1
        ${status ? sql`AND pc.status = ${status}` : sql``}
        ${partnerId ? sql`AND pc.partner_id = ${partnerId}` : sql``}
        ${expiringSoon ? sql`AND pc.end_date IS NOT NULL AND pc.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND pc.status = 'active'` : sql``}
        ORDER BY pc.created_at DESC
      `;
    } else {
      query = sql`
        SELECT pc.*, pa.username as partner_username, pa.display_name as partner_name,
               ct.name as template_name, o.name as organization_name
        FROM partner_contracts pc
        LEFT JOIN partner_access pa ON pa.id = pc.partner_id
        LEFT JOIN contract_templates ct ON ct.id = pc.template_id
        LEFT JOIN organizations o ON o.id = pc.organization_id
        WHERE pc.organization_id = ${user.organization_id}
        ${status ? sql`AND pc.status = ${status}` : sql``}
        ${partnerId ? sql`AND pc.partner_id = ${partnerId}` : sql``}
        ${expiringSoon ? sql`AND pc.end_date IS NOT NULL AND pc.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND pc.status = 'active'` : sql``}
        ORDER BY pc.created_at DESC
      `;
    }

    const contracts = await query;
    return NextResponse.json({ contracts: contracts ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/partner-contracts — Create contract (generates PDF + token)
export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      partner_id, template_id, start_date, duration_months,
      monthly_fee, hourly_fee, bonus_structure, custom_clauses, notes, status
    } = body;

    if (!partner_id || !start_date || !duration_months) {
      return NextResponse.json({ error: 'partner_id, start_date, duration_months obrigatórios' }, { status: 400 });
    }

    // Verify partner access
    const [partner] = await sql`
      SELECT id, organization_id, username, display_name, email FROM partner_access
      WHERE id = ${partner_id} LIMIT 1
    `;
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });

    if (user.role !== 'super_admin' && partner.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Get template data if provided
    let finalMonthlyFee = monthly_fee ?? 0;
    let finalHourlyFee = hourly_fee ?? 0;
    let finalBonusStructure = bonus_structure ?? null;
    let finalCustomClauses = custom_clauses ?? null;
    let finalDurationMonths = duration_months;

    if (template_id) {
      const [tpl] = await sql`SELECT * FROM contract_templates WHERE id = ${template_id} LIMIT 1`;
      if (tpl) {
        if (user.role !== 'super_admin' && tpl.organization_id !== user.organization_id) {
          return NextResponse.json({ error: 'Modelo não pertence à sua org' }, { status: 403 });
        }
        if (monthly_fee == null) finalMonthlyFee = Number(tpl.monthly_fee);
        if (hourly_fee == null) finalHourlyFee = Number(tpl.hourly_fee);
        if (bonus_structure == null) finalBonusStructure = tpl.bonus_structure;
        if (custom_clauses == null) finalCustomClauses = tpl.custom_clauses;
        if (duration_months == null && tpl.duration_months) finalDurationMonths = tpl.duration_months;
      }
    }

    // Compute end_date
    const startDate = new Date(start_date);
    const endDate = addMonths(startDate, finalDurationMonths);
    const endDateStr = isoDate(endDate);

    // Insert contract
    const contractId = randomUUID();
    const urlToken = randomUUID();
    const finalStatus = status || 'active';

    const [created] = await sql`
      INSERT INTO partner_contracts (
        id, partner_id, template_id, organization_id,
        start_date, end_date, duration_months,
        monthly_fee, hourly_fee, bonus_structure, custom_clauses,
        contract_url_token, status, notes, created_by
      )
      VALUES (
        ${contractId}, ${partner_id}, ${template_id || null}, ${partner.organization_id},
        ${start_date}, ${endDateStr}, ${finalDurationMonths},
        ${finalMonthlyFee}, ${finalHourlyFee},
        ${finalBonusStructure ? JSON.stringify(finalBonusStructure) : null}::jsonb,
        ${finalCustomClauses}, ${urlToken}, ${finalStatus}, ${notes || null}, ${user.id}
      )
      RETURNING *
    `;

    // Generate PDF + upload to R2
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await generateContractPdf({
        contractId,
        organizationName: '', // Will be filled below
        organizationId: partner.organization_id,
        partnerName: partner.display_name || partner.username,
        partnerUsername: partner.username,
        partnerEmail: partner.email || undefined,
        startDate: start_date,
        endDate: endDateStr,
        durationMonths: finalDurationMonths,
        monthlyFee: finalMonthlyFee,
        hourlyFee: finalHourlyFee,
        bonusStructure: finalBonusStructure,
        customClauses: finalCustomClauses,
        status: finalStatus,
        signedAt: null,
        createdAt: new Date().toISOString(),
      });

      // Get org name and regenerate with correct name
      const [org] = await sql`SELECT name FROM organizations WHERE id = ${partner.organization_id}`;
      pdfUrl = await generateContractPdf({
        contractId,
        organizationName: org?.name || 'Empresa',
        organizationId: partner.organization_id,
        partnerName: partner.display_name || partner.username,
        partnerUsername: partner.username,
        partnerEmail: partner.email || undefined,
        startDate: start_date,
        endDate: endDateStr,
        durationMonths: finalDurationMonths,
        monthlyFee: finalMonthlyFee,
        hourlyFee: finalHourlyFee,
        bonusStructure: finalBonusStructure,
        customClauses: finalCustomClauses,
        status: finalStatus,
        signedAt: null,
        createdAt: new Date().toISOString(),
      });

      await sql`UPDATE partner_contracts SET contract_pdf_url = ${pdfUrl} WHERE id = ${contractId}`;
    } catch (e) {
      console.error('PDF generation failed:', e);
    }

    // Create notification for admin
    await sql`
      INSERT INTO notifications (organization_id, type, title, message)
      VALUES (
        ${partner.organization_id},
        'contract_created',
        'Novo contrato gerado',
        ${`Contrato criado para ${partner.display_name || partner.username}. Vigência: ${start_date} → ${endDateStr}.`}
      )
    `;

    return NextResponse.json({
      contract: { ...created, contract_pdf_url: pdfUrl },
      url_token: urlToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Create contract error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
