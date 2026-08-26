import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const slots = await sql`
      SELECT ps.*,
        (SELECT row_to_json(p) FROM (SELECT id, name FROM playlists WHERE id = ps.playlist_id) p) as playlist
      FROM playlist_slots ps
      WHERE ps.partner_access_id = ${session.partnerAccessId}
      ORDER BY ps.slot_order ASC
    `;

    const result = slots.map((s: Record<string, unknown>) => ({
      ...s,
      playlist_name: (s.playlist as Record<string, unknown>)?.name || null,
    }));

    return NextResponse.json({ slots: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/partner/slots error:', msg);
    return NextResponse.json({ slots: [] });
  }
}
