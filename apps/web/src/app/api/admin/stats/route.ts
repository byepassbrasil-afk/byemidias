import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    let devicesCount, activeCampaigns, mediaCount, unitsCount;

    if (isSuperAdmin) {
      [devicesCount, activeCampaigns, mediaCount, unitsCount] = await Promise.all([
        sql`SELECT COUNT(*)::int as count FROM devices`,
        sql`SELECT COUNT(*)::int as count FROM campaigns WHERE status = 'active'`,
        sql`SELECT COUNT(*)::int as count FROM media`,
        sql`SELECT COUNT(*)::int as count FROM units`,
      ]);
    } else {
      [devicesCount, activeCampaigns, mediaCount, unitsCount] = await Promise.all([
        sql`SELECT COUNT(*)::int as count FROM devices WHERE organization_id = ${orgId}`,
        sql`SELECT COUNT(*)::int as count FROM campaigns WHERE status = 'active' AND organization_id = ${orgId}`,
        sql`SELECT COUNT(*)::int as count FROM media WHERE organization_id = ${orgId}`,
        sql`SELECT COUNT(*)::int as count FROM units WHERE organization_id = ${orgId}`,
      ]);
    }

    const onlineDevices = isSuperAdmin
      ? (await sql`SELECT COUNT(*)::int as count FROM devices WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'`)[0]?.count ?? 0
      : (await sql`SELECT COUNT(*)::int as count FROM devices WHERE organization_id = ${orgId} AND last_heartbeat > NOW() - INTERVAL '5 minutes'`)[0]?.count ?? 0;

    return NextResponse.json({
      data: {
        total_devices: devicesCount[0]?.count ?? 0,
        online_devices: onlineDevices,
        offline_devices: (devicesCount[0]?.count ?? 0) - onlineDevices,
        active_campaigns: activeCampaigns[0]?.count ?? 0,
        total_media: mediaCount[0]?.count ?? 0,
        total_organizations: isSuperAdmin ? (await sql`SELECT COUNT(*)::int as count FROM organizations`)[0]?.count ?? 0 : 1,
        total_units: unitsCount[0]?.count ?? 0,
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
