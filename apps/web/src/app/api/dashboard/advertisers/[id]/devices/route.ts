import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/advertisers/[id]/devices
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const devices = await sql`
      SELECT d.*, ad.contracted_at,
        CASE WHEN d.last_heartbeat > NOW() - INTERVAL '5 minutes' THEN TRUE ELSE FALSE END AS is_online
      FROM advertiser_devices ad
      INNER JOIN devices d ON d.id = ad.device_id
      WHERE ad.advertiser_id = ${id}
      ORDER BY ad.contracted_at DESC
    `;
    return NextResponse.json({ devices });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/dashboard/advertisers/[id]/devices — replace all devices
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { device_ids } = body;

    if (!Array.isArray(device_ids)) {
      return NextResponse.json({ error: 'device_ids deve ser array' }, { status: 400 });
    }

    // Delete existing
    await sql`DELETE FROM advertiser_devices WHERE advertiser_id = ${id}`;

    // Insert new
    if (device_ids.length > 0) {
      for (const device_id of device_ids) {
        await sql`
          INSERT INTO advertiser_devices (advertiser_id, device_id)
          VALUES (${id}, ${device_id})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
