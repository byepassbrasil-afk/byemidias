import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// DELETE /api/partner/slots/[id]/items/[itemId] - Delete item from slot
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const slotId = params.id;
  const itemId = params.itemId;

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

  // Delete the item
  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', itemId)
    .eq('slot_id', slotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reindex positions
  const { data: remaining } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('slot_id', slotId)
    .order('position', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase.from('playlist_items').update({ position: i }).eq('id', remaining[i].id);
    }
  }

  return NextResponse.json({ success: true });
}
