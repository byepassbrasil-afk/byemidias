import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/admin/map/devices — All devices with coords (internal, with all status)
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    let devices;
    if (user.role === 'super_admin') {
      devices = await sql`
        SELECT
          d.id, d.name, d.latitude, d.longitude, d.address, d.city, d.state,
          d.is_activated, d.status,
          o.name as organization_name, o.slug as organization_slug, o.primary_color,
          pa.display_name as partner_name,
          pc.name as campaign_name,
          d.last_heartbeat
        FROM devices d
        LEFT JOIN organizations o ON o.id = d.organization_id
        LEFT JOIN partner_devices pdev ON pdev.device_id = d.id
        LEFT JOIN partner_access pa ON pa.id = pdev.partner_access_id
        LEFT JOIN campaigns c ON c.id = d.campaign_id
        LEFT JOIN campaigns pc ON pc.id = c.id
        WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
        ORDER BY o.name, d.name
      `;
    } else {
      devices = await sql`
        SELECT
          d.id, d.name, d.latitude, d.longitude, d.address, d.city, d.state,
          d.is_activated, d.status,
          o.name as organization_name, o.slug as organization_slug, o.primary_color,
          pa.display_name as partner_name,
          pc.name as campaign_name,
          d.last_heartbeat
        FROM devices d
        LEFT JOIN organizations o ON o.id = d.organization_id
        LEFT JOIN partner_devices pdev ON pdev.device_id = d.id
        LEFT JOIN partner_access pa ON pa.id = pdev.partner_access_id
        LEFT JOIN campaigns c ON c.id = d.campaign_id
        LEFT JOIN campaigns pc ON pc.id = c.id
        WHERE d.organization_id = ${user.organization_id}
          AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
        ORDER BY d.name
      `;
    }

    return NextResponse.json({ devices });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
