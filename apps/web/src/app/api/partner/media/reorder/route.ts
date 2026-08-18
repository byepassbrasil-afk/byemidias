import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { items } = await request.json();

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Items obrigatórios' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: partnerDevices } = await supabase
    .from('partner_devices')
    .select('playlist_id')
    .eq('partner_access_id', session.partnerAccessId)
    .not('playlist_id', 'is', null);

  const playlistIds = [...new Set(
    (partnerDevices ?? []).map((pd) => pd.playlist_id)
  )];

  for (const item of items) {
    const { data: playlistItem } = await supabase
      .from('playlist_items')
      .select('id, playlist_id')
      .eq('id', item.id)
      .single();

    if (playlistItem && playlistIds.includes(playlistItem.playlist_id)) {
      await supabase
        .from('playlist_items')
        .update({ position: item.position })
        .eq('id', item.id);
    }
  }

  return NextResponse.json({ success: true });
}
