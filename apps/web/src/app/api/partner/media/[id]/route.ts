import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const mediaId = params.id;

  const [upload] = await sql`SELECT id FROM partner_media_uploads WHERE partner_access_id = ${session.partnerAccessId} AND media_id = ${mediaId}`;

  if (!upload) {
    return NextResponse.json({ error: 'Não autorizado a remover este arquivo' }, { status: 403 });
  }

  const [mediaRecord] = await sql`SELECT file_url FROM media WHERE id = ${mediaId}`;

  const partnerDevices = await sql`SELECT playlist_id FROM partner_devices WHERE partner_access_id = ${session.partnerAccessId}`;

  const playlistIds = partnerDevices.map((pd) => pd.playlist_id).filter(Boolean);

  for (const plId of playlistIds) {
    const [existingItem] = await sql`SELECT id FROM playlist_items WHERE playlist_id = ${plId} AND media_id = ${mediaId}`;

    if (existingItem) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/partner/playlists/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: plId,
          action: 'remove',
          media_id: mediaId,
        }),
      });
    }
  }

  await sql`DELETE FROM partner_media_uploads WHERE id = ${upload.id}`;

  await sql`DELETE FROM media WHERE id = ${mediaId}`;

  return NextResponse.json({ success: true });
}
