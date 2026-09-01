import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

// POST /api/admin/partner-contracts/[id]/generate-link — Regenerate public link token
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (user.role !== 'super_admin') {
      const [own] = await sql`SELECT organization_id FROM partner_contracts WHERE id = ${id}`;
      if (!own || own.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    const newToken = randomUUID();

    const [updated] = await sql`
      UPDATE partner_contracts SET contract_url_token = ${newToken}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, contract_url_token
    `;

    if (!updated) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ token: updated.contract_url_token });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
