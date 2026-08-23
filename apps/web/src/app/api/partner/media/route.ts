import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Partner can ONLY see their own uploaded media
  const { data: uploads } = await supabase
    .from('partner_media_uploads')
    .select('media_id')
    .eq('partner_access_id', session.partnerAccessId);

  const mediaIds = (uploads ?? []).map((u) => u.media_id);

  if (mediaIds.length === 0) {
    return NextResponse.json({ media: [] });
  }

  const { data: media, error } = await supabase
    .from('media')
    .select('*')
    .in('id', mediaIds)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media: media ?? [] });
}

export async function POST(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const slotId = formData.get('slot_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 50MB)' }, { status: 400 });
  }

  // Upload to storage (service_role bypasses RLS)
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const filePath = `partner-uploads/${session.partnerAccessId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);

  const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

  // Insert media record (service_role bypasses RLS)
  const { data: mediaRecord, error: insertError } = await supabase
    .from('media')
    .insert({
      organization_id: session.organizationId,
      name: file.name,
      type: mediaType,
      file_url: urlData.publicUrl,
      file_size: file.size,
      status: 'active',
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Insert failed: ' + insertError.message }, { status: 500 });
  }

  // Track partner upload
  await supabase.from('partner_media_uploads').insert({
    partner_access_id: session.partnerAccessId,
    media_id: mediaRecord.id,
  });

  // Add to slot if slot_id provided
  if (slotId) {
    // Verify partner owns this slot
    const { data: slot } = await supabase
      .from('playlist_slots')
      .select('id, playlist_id')
      .eq('id', slotId)
      .eq('partner_access_id', session.partnerAccessId)
      .single();

    if (slot) {
      // Get max position in this slot
      const { data: existingItems } = await supabase
        .from('playlist_items')
        .select('position')
        .eq('slot_id', slotId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPos = existingItems?.[0]?.position ?? -1;

      // Add item to slot (creates pending version via versioning system)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/partner/playlists/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' },
        body: JSON.stringify({
          playlist_id: slot.playlist_id,
          action: 'add',
          media_id: mediaRecord.id,
          slot_id: slotId,
        }),
      });
    }
  }

  return NextResponse.json({ success: true, mediaId: mediaRecord.id });
}
