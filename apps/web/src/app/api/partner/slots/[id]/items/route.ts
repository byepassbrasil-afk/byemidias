import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/partner/slots/[id]/items - List items in a slot
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const slotId = params.id;

  // Verify partner owns this slot
  const { data: slot } = await supabase
    .from('playlist_slots')
    .select('id')
    .eq('id', slotId)
    .eq('partner_access_id', session.partnerAccessId)
    .single();

  if (!slot) {
    return NextResponse.json({ error: 'Slot não encontrado ou não autorizado' }, { status: 404 });
  }

  // Get items in this slot
  const { data: items, error } = await supabase
    .from('playlist_items')
    .select('*')
    .eq('slot_id', slotId)
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get media details
  const mediaIds = (items ?? []).map((i) => i.media_id);
  let mediaMap: Record<string, unknown> = {};

  if (mediaIds.length > 0) {
    const { data: mediaData } = await supabase
      .from('media')
      .select('*')
      .in('id', mediaIds);

    mediaMap = Object.fromEntries((mediaData ?? []).map((m) => [m.id, m]));
  }

  const result = (items ?? []).map((item) => ({
    ...item,
    media: mediaMap[item.media_id] || null,
  }));

  return NextResponse.json({ items: result });
}
