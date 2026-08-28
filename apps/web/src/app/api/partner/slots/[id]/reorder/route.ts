import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql, { bumpContentVersion } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: slotId } = await params;

    const [slot] = await sql`SELECT ps.id, p.organization_id FROM playlist_slots ps JOIN playlists p ON p.id = ps.playlist_id WHERE ps.id = ${slotId} AND ps.partner_access_id = ${session.partnerAccessId}`;
    if (!slot) {
      return NextResponse.json({ error: 'Slot não encontrado' }, { status: 404 });
    }

    const { items } = await request.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items obrigatório' }, { status: 400 });
    }

    for (const item of items) {
      await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id} AND slot_id = ${slotId}`;
    }

    if (slot.organization_id) bumpContentVersion(slot.organization_id as string).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
