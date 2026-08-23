import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/device/activate
// Recovery flow:
//   1. Same device_uuid + same code → return existing device (reconnection)
//   2. New device_uuid + code already used → find device linked to code, re-link it
//   3. New device_uuid + unused code → create new device
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { device_uuid, activation_code, model, manufacturer, os_version, player_version, resolution } = body;

    if (!device_uuid || !activation_code) {
      return NextResponse.json({ error: 'device_uuid e activation_code obrigatórios' }, { status: 400 });
    }

    const code = activation_code.toUpperCase().trim();

    // Find activation code
    const { data: codeRecord } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (!codeRecord) {
      return NextResponse.json({ error: 'Código de ativação inválido' }, { status: 401 });
    }

    // Check expiration
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Código de ativação expirado' }, { status: 401 });
    }

    // Check if device already exists (by UUID)
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id, is_activated, activation_code')
      .eq('device_uuid', device_uuid)
      .single();

    if (existingDevice) {
      // Device exists - update it and return
      await supabase
        .from('devices')
        .update({
          model: model || null,
          manufacturer: manufacturer || null,
          os_version: os_version || null,
          player_version: player_version || null,
          resolution: resolution || null,
          is_activated: true,
          activation_code: code,
          status: 'online',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('id', existingDevice.id);

      return NextResponse.json({
        device_id: existingDevice.id,
        recovered: true,
        content_version: 0,
      });
    }

    // Check if code was already used → recovery: find the device linked to this code
    if (codeRecord.device_id && codeRecord.use_count >= codeRecord.max_uses) {
      // Find the device linked to this code
      const { data: linkedDevice } = await supabase
        .from('devices')
        .select('id')
        .eq('id', codeRecord.device_id)
        .single();

      if (linkedDevice) {
        // Re-link: update device with new UUID
        await supabase
          .from('devices')
          .update({
            device_uuid: device_uuid,
            model: model || null,
            manufacturer: manufacturer || null,
            os_version: os_version || null,
            player_version: player_version || null,
            resolution: resolution || null,
            is_activated: true,
            activation_code: code,
            status: 'online',
            last_heartbeat: new Date().toISOString(),
          })
          .eq('id', linkedDevice.id);

        return NextResponse.json({
          device_id: linkedDevice.id,
          recovered: true,
          content_version: 0,
        });
      }
    }

    // Check max_uses for new activations
    if (codeRecord.use_count >= codeRecord.max_uses) {
      return NextResponse.json({ error: 'Código de ativação atingiu o limite de uso' }, { status: 401 });
    }

    // Create new device
    const { data: newDevice, error: createError } = await supabase
      .from('devices')
      .insert({
        device_uuid,
        organization_id: codeRecord.organization_id,
        name: `${manufacturer || 'Unknown'} ${model || 'Device'}`,
        model: model || null,
        manufacturer: manufacturer || null,
        os_version: os_version || null,
        player_version: player_version || null,
        resolution: resolution || null,
        activation_code: code,
        is_activated: true,
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        content_version: 0,
      })
      .select('id')
      .single();

    if (createError || !newDevice) {
      return NextResponse.json({ error: 'Erro ao criar dispositivo: ' + (createError?.message || 'unknown') }, { status: 500 });
    }

    // Update activation code usage
    await supabase
      .from('activation_codes')
      .update({
        use_count: codeRecord.use_count + 1,
        device_id: newDevice.id,
        status: codeRecord.use_count + 1 >= codeRecord.max_uses ? 'used' : 'pending',
        used_at: new Date().toISOString(),
      })
      .eq('id', codeRecord.id);

    return NextResponse.json({
      device_id: newDevice.id,
      recovered: false,
      content_version: 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
