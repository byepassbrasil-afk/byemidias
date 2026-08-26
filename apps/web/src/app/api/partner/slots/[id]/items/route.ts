import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: slotId } = await params;

    const [slot] = await sql`SELECT id FROM playlist_slots WHERE id = ${slotId} AND partner_access_id = ${session.partnerAccessId}`;

    if (!slot) {
      return NextResponse.json({ error: 'Slot não encontrado' }, { status: 404 });
    }

    const items = await sql`SELECT * FROM playlist_items WHERE slot_id = ${slotId} ORDER BY position ASC`;

    const mediaIds = items.map((i: Record<string, unknown>) => i.media_id as string);
    let mediaMap: Record<string, unknown> = {};

    if (mediaIds.length > 0) {
      const mediaData = await sql`SELECT * FROM media WHERE id = ANY(${mediaIds})`;
      mediaMap = Object.fromEntries(mediaData.map((m: Record<string, unknown>) => [m.id, m]));
    }

    const result = items.map((item: Record<string, unknown>) => ({
      ...item,
      media: mediaMap[item.media_id as string] || null,
    }));

    return NextResponse.json({ items: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/partner/slots/items error:', msg);
    return NextResponse.json({ items: [] });
  }
}
