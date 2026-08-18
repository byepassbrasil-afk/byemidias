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

  const { data: partnerDevices, error } = await supabase
    .from('partner_devices')
    .select(`
      id,
      partner_access_id,
      device_id,
      playlist_id,
      created_at,
      devices!inner (
        id, name, device_uuid, status, last_heartbeat, player_version, model
      ),
      playlists (
        id, name
      )
    `)
    .eq('partner_access_id', session.partnerAccessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const devices = (partnerDevices ?? []).map((pd: Record<string, unknown>) => {
    const devices = pd.devices as Record<string, unknown> | null;
    const playlists = pd.playlists as Record<string, unknown> | null;
    return {
      id: pd.id,
      partner_access_id: pd.partner_access_id,
      device_id: pd.device_id,
      playlist_id: pd.playlist_id,
      created_at: pd.created_at,
      device_name: devices?.name ?? 'Desconhecido',
      device_status: devices?.status ?? 'inactive',
      device_uuid: devices?.device_uuid ?? '',
      playlist_name: playlists?.name ?? null,
    };
  });

  return NextResponse.json({ devices });
}
