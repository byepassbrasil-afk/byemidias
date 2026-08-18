import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// PUT /api/partner/slots/[id]/reorder - Reorder items in slot
export async function PUT(
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

  const { items } = await request.json();

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'items obrigatório' }, { status: 400 });
  }

  // Update positions
  for (const item of items) {
    await supabase
      .from('playlist_items')
      .update({ position: item.position })
      .eq('id', item.id)
      .eq('slot_id', slotId);
  }

  return NextResponse.json({ success: true });
}
