import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET(
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

  const items = await sql`SELECT * FROM playlist_items WHERE slot_id = ${slotId} ORDER BY position ASC`;

  const mediaIds = items.map((i) => i.media_id);
  let mediaMap: Record<string, unknown> = {};

  if (mediaIds.length > 0) {
    const mediaData = await sql`SELECT * FROM media WHERE id = ANY(${mediaIds})`;
    mediaMap = Object.fromEntries(mediaData.map((m) => [m.id, m]));
  }

  const result = items.map((item) => ({
    ...item,
    media: mediaMap[item.media_id] || null,
  }));

  return NextResponse.json({ items: result });
}
