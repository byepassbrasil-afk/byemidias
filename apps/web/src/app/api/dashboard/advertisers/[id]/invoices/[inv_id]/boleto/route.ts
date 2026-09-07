import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { generateBoletoPdf } from '@/lib/pdf-boleto';

// GET /api/dashboard/advertisers/[id]/invoices/[inv_id]/boleto
export async function GET(request: NextRequest, { params }: { params: { id: string; inv_id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { inv_id } = params;

    const [invoice] = await sql`
      SELECT ai.*, a.name as advertiser_name, a.establishment_name, a.document as advertiser_document,
             a.email as advertiser_email, a.address as advertiser_address,
             o.name as organization_name
      FROM advertiser_invoices ai
      INNER JOIN advertisers a ON a.id = ai.advertiser_id
      INNER JOIN organizations o ON o.id = ai.organization_id
      WHERE ai.id = ${inv_id}
    `;

    if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    const pdfUrl = await generateBoletoPdf({
      invoiceId: invoice.id,
      advertiserName: invoice.advertiser_name,
      advertiserEstablishment: invoice.establishment_name,
      advertiserDocument: invoice.advertiser_document,
      advertiserEmail: invoice.advertiser_email,
      advertiserAddress: invoice.advertiser_address,
      organizationName: invoice.organization_name,
      organizationDocument: invoice.organization_document,
      amount: Number(invoice.amount),
      dueDate: invoice.due_date,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      status: invoice.status,
      createdAt: invoice.created_at,
    });

    return NextResponse.json({ pdf_url: pdfUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[boleto] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
