import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const uploads = await sql`SELECT media_id FROM partner_media_uploads WHERE partner_access_id = ${session.partnerAccessId}`;

  const mediaIds = uploads.map((u) => u.media_id);

  if (mediaIds.length === 0) {
    return NextResponse.json({ media: [] });
  }

  const media = await sql`SELECT * FROM media WHERE id = ANY(${mediaIds}) ORDER BY created_at DESC`;

  return NextResponse.json({ media: media ?? [] });
}

export async function POST(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const formData = await request.json();
  const { name: fileName, type: fileType, size: fileSize } = formData;

  if (!fileName) {
    return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  if (!allowedTypes.includes(fileType)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 });
  }

  if (fileSize > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 50MB)' }, { status: 400 });
  }

  const mediaType = fileType.startsWith('image/') ? 'image' : 'video';
  const fileUrl = formData.file_url || `partner-uploads/${session.partnerAccessId}/${Date.now()}-${fileName}`;

  const [mediaRecord] = await sql`
    INSERT INTO media (organization_id, name, type, file_url, file_size, status)
    VALUES (${session.organizationId}, ${fileName}, ${mediaType}, ${fileUrl}, ${fileSize}, 'active')
    RETURNING id
  `;

  await sql`INSERT INTO partner_media_uploads (partner_access_id, media_id) VALUES (${session.partnerAccessId}, ${mediaRecord.id})`;

  if (formData.slot_id) {
    const [slot] = await sql`SELECT id, playlist_id FROM playlist_slots WHERE id = ${formData.slot_id} AND partner_access_id = ${session.partnerAccessId}`;

    if (slot) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/partner/playlists/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: slot.playlist_id,
          action: 'add',
          media_id: mediaRecord.id,
          slot_id: formData.slot_id,
        }),
      });
    }
  }

  return NextResponse.json({ success: true, mediaId: mediaRecord.id });
}
