import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const mediaId = params.id;

  const { data: upload } = await supabase
    .from('partner_media_uploads')
    .select('id')
    .eq('partner_access_id', session.partnerAccessId)
    .eq('media_id', mediaId)
    .single();

  if (!upload) {
    return NextResponse.json({ error: 'Não autorizado a remover este arquivo' }, { status: 403 });
  }

  // Get media file path before deleting record
  const { data: mediaRecord } = await supabase
    .from('media')
    .select('file_url')
    .eq('id', mediaId)
    .single();

  // Find playlists that contain this media (via partner_devices)
  const { data: partnerDevices } = await supabase
    .from('partner_devices')
    .select('playlist_id')
    .eq('partner_access_id', session.partnerAccessId);

  const playlistIds = (partnerDevices ?? []).map((pd) => pd.playlist_id).filter(Boolean) as string[];

  // Create pending versions for each playlist that contains this media
  for (const plId of playlistIds) {
    const { data: existingItem } = await supabase
      .from('playlist_items')
      .select('id')
      .eq('playlist_id', plId)
      .eq('media_id', mediaId)
      .single();

    if (existingItem) {
      // Use the versioning system to remove media from playlist
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/partner/playlists/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' },
        body: JSON.stringify({
          playlist_id: plId,
          action: 'remove',
          media_id: mediaId,
        }),
      });
    }
  }

  await supabase.from('partner_media_uploads').delete().eq('id', upload.id);

  const { error } = await supabase.from('media').delete().eq('id', mediaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove file from storage
  if (mediaRecord?.file_url) {
    const pathMatch = mediaRecord.file_url.match(/partner-uploads\/(.+)/);
    if (pathMatch) {
      await supabase.storage.from('media').remove([`partner-uploads/${pathMatch[1]}`]);
    }
  }

  return NextResponse.json({ success: true });
}
