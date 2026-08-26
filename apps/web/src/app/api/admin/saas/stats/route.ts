import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const [orgCount] = await sql`SELECT COUNT(*) as count FROM organizations`;
  const [activeOrgs] = await sql`SELECT COUNT(*) as count FROM organizations WHERE status = 'active'`;
  const [expiredOrgs] = await sql`SELECT COUNT(*) as count FROM organizations WHERE renewal_date < CURRENT_DATE AND status = 'active'`;
  const [deviceCount] = await sql`SELECT COUNT(*) as count FROM devices`;
  const [onlineDevices] = await sql`SELECT COUNT(*) as count FROM devices WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'`;
  const [campaignCount] = await sql`SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'`;
  const [mediaCount] = await sql`SELECT COUNT(*) as count FROM media WHERE status = 'active'`;
  const [userCount] = await sql`SELECT COUNT(*) as count FROM profiles WHERE status = 'active'`;
  const [totalRevenue] = await sql`SELECT COALESCE(SUM(monthly_price), 0) as total FROM organizations WHERE status = 'active'`;
  const [totalExpenses] = await sql`SELECT COALESCE(SUM(total_expenses), 0) as total FROM organizations`;
  const [totalRevenueAll] = await sql`SELECT COALESCE(SUM(total_revenue), 0) as total FROM organizations`;

  const orgs = await sql`
    SELECT o.id, o.name, o.slug, o.status, o.plan, o.renewal_date, o.monthly_price,
           o.total_revenue, o.total_expenses, o.created_at,
           (SELECT COUNT(*) FROM devices d WHERE d.organization_id = o.id) as device_count,
           (SELECT COUNT(*) FROM campaigns c WHERE c.organization_id = o.id AND c.status = 'active') as campaign_count,
           (SELECT COUNT(*) FROM media m WHERE m.organization_id = o.id AND m.status = 'active') as media_count
    FROM organizations o
    ORDER BY o.created_at DESC
  `;

  const expiringSoon = orgs.filter((o: Record<string, unknown>) => {
    if (!o.renewal_date) return false;
    const renewal = new Date(o.renewal_date as string);
    const now = new Date();
    const daysUntil = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil >= 0;
  });

  return NextResponse.json({
    stats: {
      total_orgs: parseInt(orgCount?.count || '0'),
      active_orgs: parseInt(activeOrgs?.count || '0'),
      expired_orgs: parseInt(expiredOrgs?.count || '0'),
      total_devices: parseInt(deviceCount?.count || '0'),
      online_devices: parseInt(onlineDevices?.count || '0'),
      active_campaigns: parseInt(campaignCount?.count || '0'),
      total_media: parseInt(mediaCount?.count || '0'),
      total_users: parseInt(userCount?.count || '0'),
      monthly_revenue: parseFloat(totalRevenue?.total || '0'),
      total_revenue: parseFloat(totalRevenueAll?.total || '0'),
      total_expenses: parseFloat(totalExpenses?.total || '0'),
      profit: parseFloat(totalRevenueAll?.total || '0') - parseFloat(totalExpenses?.total || '0'),
    },
    organizations: orgs,
    expiring_soon: expiringSoon,
  });
}
