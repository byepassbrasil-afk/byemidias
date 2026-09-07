import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET/PUT/DELETE /api/dashboard/advertisers/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;

    let advertiser;
    if (user.role === 'super_admin') {
      [advertiser] = await sql`
        SELECT a.id, a.organization_id, a.name, a.establishment_name, a.email, a.phone,
               a.document, a.address, a.ticket_value, a.status, a.created_at,
          (SELECT COUNT(*) FROM advertiser_devices ad WHERE ad.advertiser_id = a.id)::int AS device_count,
          (SELECT COUNT(*) FROM advertiser_media am WHERE am.advertiser_id = a.id)::int AS media_count,
          o.name as organization_name
        FROM advertisers a
        LEFT JOIN organizations o ON o.id = a.organization_id
        WHERE a.id = ${id}
      `;
    } else {
      [advertiser] = await sql`
        SELECT a.id, a.organization_id, a.name, a.establishment_name, a.email, a.phone,
               a.document, a.address, a.ticket_value, a.status, a.created_at,
          (SELECT COUNT(*) FROM advertiser_devices ad WHERE ad.advertiser_id = a.id)::int AS device_count,
          (SELECT COUNT(*) FROM advertiser_media am WHERE am.advertiser_id = a.id)::int AS media_count,
          o.name as organization_name
        FROM advertisers a
        LEFT JOIN organizations o ON o.id = a.organization_id
        WHERE a.id = ${id} AND a.organization_id = ${user.organization_id!}
      `;
    }

    if (!advertiser) return NextResponse.json({ error: 'Anunciante não encontrado' }, { status: 404 });

    return NextResponse.json({ advertiser });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { name, establishment_name, email, phone, document, address, ticket_value, status } = body;

    const [updated] = await sql`
      UPDATE advertisers SET
        name = COALESCE(${name}, name),
        establishment_name = COALESCE(${establishment_name}, establishment_name),
        email = COALESCE(${email}, email),
        phone = COALESCE(${phone}, phone),
        document = COALESCE(${document}, document),
        address = COALESCE(${address}, address),
        ticket_value = COALESCE(${ticket_value}, ticket_value),
        status = COALESCE(${status}, status)
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) return NextResponse.json({ error: 'Anunciante não encontrado' }, { status: 404 });

    return NextResponse.json({ advertiser: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    await sql`DELETE FROM advertisers WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
