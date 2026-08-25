import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const [devicesCount, activeCampaigns, mediaCount, orgsCount, unitsCount] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM devices`,
      sql`SELECT COUNT(*)::int as count FROM campaigns WHERE status = 'active'`,
      sql`SELECT COUNT(*)::int as count FROM media`,
      sql`SELECT COUNT(*)::int as count FROM organizations`,
      sql`SELECT COUNT(*)::int as count FROM units`,
    ]);

    return NextResponse.json({
      data: {
        total_devices: devicesCount[0]?.count ?? 0,
        online_devices: 0,
        offline_devices: 0,
        active_campaigns: activeCampaigns[0]?.count ?? 0,
        total_media: mediaCount[0]?.count ?? 0,
        total_organizations: orgsCount[0]?.count ?? 0,
        total_units: unitsCount[0]?.count ?? 0,
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
