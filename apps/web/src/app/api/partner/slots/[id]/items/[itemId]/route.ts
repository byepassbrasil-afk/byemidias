import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: slotId, itemId } = await params;

    const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slotId} AND partner_access_id = ${session.partnerAccessId}`;
    if (!slot) {
      return NextResponse.json({ error: 'Slot não encontrado' }, { status: 404 });
    }

    await sql`DELETE FROM playlist_items WHERE id = ${itemId} AND slot_id = ${slotId}`;

    const remaining = await sql`SELECT id FROM playlist_items WHERE slot_id = ${slotId} ORDER BY position ASC`;
    for (let i = 0; i < remaining.length; i++) {
      await sql`UPDATE playlist_items SET position = ${i} WHERE id = ${remaining[i].id}`;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
