import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/advertisers/[id]/media
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const media = await sql`
      SELECT * FROM advertiser_media
      WHERE advertiser_id = ${id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ media });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/advertisers/[id]/media
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { name, file_url, type } = body;

    if (!name || !file_url) {
      return NextResponse.json({ error: 'name e file_url obrigatórios' }, { status: 400 });
    }

    const organization_id = user.role === 'super_admin' && body.organization_id
      ? body.organization_id
      : user.organization_id;

    const [media] = await sql`
      INSERT INTO advertiser_media (advertiser_id, organization_id, name, file_url, type)
      VALUES (${id}, ${organization_id}, ${name}, ${file_url}, ${type || 'image'})
      RETURNING *
    `;

    return NextResponse.json({ media }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/dashboard/advertisers/[id]/media?media_id=X
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');

    if (!mediaId) return NextResponse.json({ error: 'media_id obrigatório' }, { status: 400 });

    await sql`DELETE FROM advertiser_media WHERE id = ${mediaId} AND advertiser_id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
