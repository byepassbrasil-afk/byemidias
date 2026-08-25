import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const partnerDevices = await sql`
    SELECT pd.id, pd.partner_access_id, pd.device_id, pd.playlist_id, pd.created_at,
      d.id as d_id, d.name as device_name, d.device_uuid, d.status as device_status, d.last_heartbeat, d.player_version, d.model,
      p.id as p_id, p.name as playlist_name
    FROM partner_devices pd
    INNER JOIN devices d ON d.id = pd.device_id
    LEFT JOIN playlists p ON p.id = pd.playlist_id
    WHERE pd.partner_access_id = ${session.partnerAccessId}
  `;

  const devices = partnerDevices.map((pd) => ({
    id: pd.id,
    partner_access_id: pd.partner_access_id,
    device_id: pd.device_id,
    playlist_id: pd.playlist_id,
    created_at: pd.created_at,
    device_name: pd.device_name ?? 'Desconhecido',
    device_status: pd.device_status ?? 'inactive',
    device_uuid: pd.device_uuid ?? '',
    playlist_name: pd.playlist_name ?? null,
  }));

  return NextResponse.json({ devices });
}
