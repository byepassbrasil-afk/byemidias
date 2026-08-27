import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role, organization_id FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    let codes;
    if (profile.role !== 'super_admin' && profile.organization_id) {
      codes = await sql`
        SELECT ac.*, row_to_json(d.*) as device
        FROM activation_codes ac
        LEFT JOIN devices d ON d.id = ac.linked_device_id
        WHERE ac.organization_id = ${profile.organization_id}
        ORDER BY ac.created_at DESC
      `;
    } else {
      codes = await sql`
        SELECT ac.*, row_to_json(d.*) as device
        FROM activation_codes ac
        LEFT JOIN devices d ON d.id = ac.linked_device_id
        ORDER BY ac.created_at DESC
      `;
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role, organization_id FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { count = 1, organization_id, expires_at, max_uses = 50 } = body;

    const orgId = organization_id || profile.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });
    }

    const insertedCodes = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      const [row] = await sql`
        INSERT INTO activation_codes (code, organization_id, status, max_uses, use_count, expires_at, created_by)
        VALUES (${generateCode()}, ${orgId}, 'active', ${max_uses}, 0, ${expires_at || null}, ${user.id})
        RETURNING *
      `;
      insertedCodes.push(row);
    }

    return NextResponse.json({ codes: insertedCodes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    await sql`DELETE FROM activation_codes WHERE id = ${codeId}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
