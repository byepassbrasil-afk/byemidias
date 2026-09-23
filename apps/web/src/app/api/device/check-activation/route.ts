import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


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

    const pb = await getAdminClient();

    // 1. Buscar device por device_uuid
    let device: any = null;
    try {
      const filter = `device_uuid = "${deviceUuid.replace(/"/g, '\\"')}"`;
      const list = await pb.collection('devices').getList(1, 1, { filter });
      if (list.items.length > 0) device = list.items[0];
    } catch (e: any) {
      console.error('[check-activation] erro:', e.message);
    }

    if (!device) {
      return NextResponse.json({ activated: false, exists: false });
    }

    // 2. Considera ativado se status === 'online' OU organization_id setada
    const isActivated = device.status === 'online';

    return NextResponse.json({
      exists: true,
      activated: isActivated,
      device_id: device.id,
      organization_id: device.organization_id,
      name: device.name,
      status: device.status,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[check-activation] erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
