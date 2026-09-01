import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/contract-view/[token] — Public endpoint to view a contract by its token
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'token obrigatório' }, { status: 400 });
    }

    const [contract] = await sql`
      SELECT pc.*, pa.username as partner_username, pa.display_name as partner_name, pa.email as partner_email,
             o.name as organization_name, ct.name as template_name
      FROM partner_contracts pc
      LEFT JOIN partner_access pa ON pa.id = pc.partner_id
      LEFT JOIN organizations o ON o.id = pc.organization_id
      LEFT JOIN contract_templates ct ON ct.id = pc.template_id
      WHERE pc.contract_url_token = ${token}
      LIMIT 1
    `;

    if (!contract) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ contract });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
