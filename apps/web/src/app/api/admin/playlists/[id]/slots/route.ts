import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const slots = await sql`
      SELECT ps.*,
        (SELECT row_to_json(pa) FROM (SELECT id, username, display_name FROM partner_access WHERE id = ps.partner_access_id) pa) as partner
      FROM playlist_slots ps
      WHERE ps.playlist_id = ${params.id}
      ORDER BY ps.slot_order ASC
    `;

    return NextResponse.json({ slots: slots ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { partner_access_id, duration_seconds, slot_order } = await request.json();

    if (!partner_access_id || !duration_seconds) {
      return NextResponse.json({ error: 'partner_access_id e duration_seconds obrigatórios' }, { status: 400 });
    }

    let order = slot_order;
    if (order === undefined || order === null) {
      const [existing] = await sql`SELECT slot_order FROM playlist_slots WHERE playlist_id = ${params.id} ORDER BY slot_order DESC LIMIT 1`;
      order = (existing?.slot_order ?? -1) + 1;
    }

    try {
      const [slot] = await sql`
        INSERT INTO playlist_slots (playlist_id, partner_access_id, slot_order, duration_seconds)
        VALUES (${params.id}, ${partner_access_id}, ${order}, ${duration_seconds})
        RETURNING *
      `;

      const [partnerInfo] = await sql`SELECT id, username, display_name FROM partner_access WHERE id = ${partner_access_id}`;

      // Bump content version
      const [pl] = await sql`SELECT organization_id FROM playlists WHERE id = ${params.id}`;
      if (pl?.organization_id) bumpContentVersion(pl.organization_id).catch(() => {});

      return NextResponse.json({ slot: { ...slot, partner: partnerInfo || null } });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Já existe um slot nesta posição' }, { status: 409 });
      }
      return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { slot_id, duration_seconds, slot_order } = await request.json();

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id obrigatório' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
    if (slot_order !== undefined) updateData.slot_order = slot_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true });
    }

    await sql`UPDATE playlist_slots SET ${sql(updateData)} WHERE id = ${slot_id} AND playlist_id = ${params.id}`;

    // Bump content version
    const [pl] = await sql`SELECT organization_id FROM playlists WHERE id = ${params.id}`;
    if (pl?.organization_id) bumpContentVersion(pl.organization_id).catch(() => {});

    return NextResponse.json({ success: true });
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

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slot_id');

    if (!slotId) {
      return NextResponse.json({ error: 'slot_id obrigatório' }, { status: 400 });
    }

    await sql`DELETE FROM playlist_items WHERE slot_id = ${slotId}`;

    await sql`DELETE FROM playlist_slots WHERE id = ${slotId}`;

    // Bump content version
    const [pl] = await sql`SELECT organization_id FROM playlists WHERE id = ${params.id}`;
    if (pl?.organization_id) bumpContentVersion(pl.organization_id).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
