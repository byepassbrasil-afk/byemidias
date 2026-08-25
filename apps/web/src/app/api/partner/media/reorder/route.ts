import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function PUT(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { items } = await request.json();

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Items obrigatórios' }, { status: 400 });
  }

  const partnerDevices = await sql`SELECT playlist_id FROM partner_devices WHERE partner_access_id = ${session.partnerAccessId} AND playlist_id IS NOT NULL`;

  const playlistIds = [...new Set(partnerDevices.map((pd) => pd.playlist_id))];

  for (const item of items) {
    const [playlistItem] = await sql`SELECT id, playlist_id FROM playlist_items WHERE id = ${item.id}`;

    if (playlistItem && playlistIds.includes(playlistItem.playlist_id)) {
      await sql`UPDATE playlist_items SET position = ${item.position} WHERE id = ${item.id}`;
    }
  }

  return NextResponse.json({ success: true });
}
