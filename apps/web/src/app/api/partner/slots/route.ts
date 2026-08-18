import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/partner/slots - List partner's slots
export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: slots, error } = await supabase
    .from('playlist_slots')
    .select(`
      *,
      playlist:playlists(name)
    `)
    .eq('partner_access_id', session.partnerAccessId)
    .order('slot_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten playlist name
  const result = (slots ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    playlist_name: (s.playlist as Record<string, unknown> | null)?.name || null,
  }));

  return NextResponse.json({ slots: result });
}
