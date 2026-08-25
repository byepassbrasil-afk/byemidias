import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const slotId = params.id;

  const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slotId} AND partner_access_id = ${session.partnerAccessId}`;

  if (!slot) {
    return NextResponse.json({ error: 'Slot não encontrado ou não autorizado' }, { status: 404 });
  }

  const { items } = await request.json();

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'items obrigatório' }, { status: 400 });
  }

  for (const item of items) {
    await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id} AND slot_id = ${slotId}`;
  }

  return NextResponse.json({ success: true });
}
