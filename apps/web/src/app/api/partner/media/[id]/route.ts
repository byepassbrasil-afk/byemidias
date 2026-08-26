import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: mediaId } = await params;

    const [upload] = await sql`SELECT id FROM partner_media_uploads WHERE partner_access_id = ${session.partnerAccessId} AND media_id = ${mediaId}`;
    if (!upload) {
      return NextResponse.json({ error: 'Não autorizado a remover este arquivo' }, { status: 403 });
    }

    await sql`DELETE FROM partner_media_uploads WHERE id = ${upload.id}`;
    await sql`DELETE FROM media WHERE id = ${mediaId}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
