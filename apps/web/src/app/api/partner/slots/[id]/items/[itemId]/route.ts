import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const slotId = params.id;
  const itemId = params.itemId;

  const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slotId} AND partner_access_id = ${session.partnerAccessId}`;

  if (!slot) {
    return NextResponse.json({ error: 'Slot não encontrado ou não autorizado' }, { status: 404 });
  }

  await sql`DELETE FROM playlist_items WHERE id = ${itemId} AND slot_id = ${slotId}`;

  const remaining = await sql`SELECT id FROM playlist_items WHERE slot_id = ${slotId} ORDER BY position ASC`;

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await sql`UPDATE playlist_items SET position = ${i} WHERE id = ${remaining[i].id}`;
    }
  }

  return NextResponse.json({ success: true });
}
