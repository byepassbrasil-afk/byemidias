import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

/**
 * Check if a device has been activated externally (via admin scan).
 * The TV polls this endpoint while on the activation screen.
 * If activated=true, returns the device_id so TV can save it locally.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceUuid = searchParams.get('device_uuid');

    if (!deviceUuid) {
      return NextResponse.json({ error: 'device_uuid obrigatório' }, { status: 400 });
    }

    const [device] = await sql`
      SELECT id, organization_id, is_activated, status, name
      FROM devices WHERE device_uuid = ${deviceUuid} LIMIT 1
    `;

    if (!device) {
      return NextResponse.json({ activated: false, exists: false });
    }

    return NextResponse.json({
      exists: true,
      activated: device.is_activated === true,
      device_id: device.id,
      organization_id: device.organization_id,
      name: device.name,
      status: device.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
