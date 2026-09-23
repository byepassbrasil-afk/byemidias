import { NextResponse, NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// POST /api/device/activate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_uuid, activation_code, model, manufacturer, os_version, player_version, resolution } = body;

    if (!device_uuid || !activation_code) {
      return NextResponse.json({ error: 'device_uuid e activation_code obrigatórios' }, { status: 400 });
    }

    const code = activation_code.toUpperCase().trim();
    const pb = await getAdminClient();

    // Find activation code
    let codeRecord: any = null;
    try {
      const list = await pb.collection('activation_codes').getList(1, 1, {
        filter: `code = "${code}"`,
      });
      if (list.items.length > 0) codeRecord = list.items[0];
    } catch (e: any) {
      console.error('[activate] erro ao buscar code:', e.message);
    }

    if (!codeRecord) {
      return NextResponse.json({ error: 'Código de ativação inválido' }, { status: 401 });
    }

    // Check expiration
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Código de ativação expirado' }, { status: 401 });
    }

    // Check if device already exists (by UUID)
    let existingDevice: any = null;
    try {
      const list = await pb.collection('devices').getList(1, 1, {
        filter: `device_uuid = "${device_uuid}"`,
      });
      if (list.items.length > 0) existingDevice = list.items[0];
    } catch (e: any) {}

    if (existingDevice) {
      await pb.collection('devices').update(existingDevice.id, {
        model: model || null,
        manufacturer: manufacturer || null,
        os_version: os_version || null,
        player_version: player_version || null,
        resolution: resolution || null,
        activation_code: code,
        status: 'online',
        last_heartbeat: new Date().toISOString(),
      });
      return NextResponse.json({ device_id: existingDevice.id, recovered: true, content_version: existingDevice.content_version || 0 });
    }

    // Recovery: code already used → re-link device
    if (codeRecord.linked_device_id && codeRecord.use_count >= codeRecord.max_uses) {
      try {
        const linked = await pb.collection('devices').getOne(codeRecord.linked_device_id);
        await pb.collection('devices').update(linked.id, {
          device_uuid: device_uuid,
          model: model || null,
          manufacturer: manufacturer || null,
          os_version: os_version || null,
          player_version: player_version || null,
          resolution: resolution || null,
          activation_code: code,
          status: 'online',
          last_heartbeat: new Date().toISOString(),
        });
        return NextResponse.json({ device_id: linked.id, recovered: true, content_version: 0 });
      } catch (e) {}
    }

    // Check max_uses
    const useCount = codeRecord.use_count || 0;
    const maxUses = codeRecord.max_uses || 0;
    if (maxUses > 0 && useCount >= maxUses) {
      return NextResponse.json({ error: 'Código de ativação atingiu o limite de uso' }, { status: 401 });
    }

    // Create new device
    const deviceName = `${manufacturer || 'Unknown'} ${model || 'Device'}`;
    const newDevice = await pb.collection('devices').create({
      organization_id: codeRecord.organization_id,
      device_uuid: device_uuid,
      name: deviceName,
      model: model || null,
      manufacturer: manufacturer || null,
      os_version: os_version || null,
      player_version: player_version || null,
      resolution: resolution || null,
      activation_code: code,
      status: 'online',
      last_heartbeat: new Date().toISOString(),
      content_version: 0,
    });

    // Update activation code usage
    await pb.collection('activation_codes').update(codeRecord.id, {
      use_count: useCount + 1,
      linked_device_id: newDevice.id,
      status: (useCount + 1 >= maxUses && maxUses > 0) ? 'used' : 'active',
    });

    return NextResponse.json({ device_id: newDevice.id, recovered: false, content_version: 0 });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[activate] erro:', msg, e.data);
    return NextResponse.json({ error: msg, data: e.data }, { status: 500 });
  }
}
