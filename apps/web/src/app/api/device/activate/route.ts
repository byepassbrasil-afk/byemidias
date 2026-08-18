import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/device/activate - Activate device with activation code
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { device_uuid, activation_code, model, manufacturer, os_version, player_version, resolution } = body;

    if (!device_uuid || !activation_code) {
      return NextResponse.json({ error: 'device_uuid e activation_code obrigatórios' }, { status: 400 });
    }

    // Find and validate activation code
    const { data: codeRecord, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', activation_code.toUpperCase().trim())
      .eq('status', 'pending')
      .single();

    if (codeError || !codeRecord) {
      return NextResponse.json({ error: 'Código de ativação inválido ou já utilizado' }, { status: 401 });
    }

    // Check expiration
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Código de ativação expirado' }, { status: 401 });
    }

    // Check max uses
    if (codeRecord.use_count >= codeRecord.max_uses) {
      return NextResponse.json({ error: 'Código de ativação atingiu o limite de uso' }, { status: 401 });
    }

    // Check if device already exists
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id, is_activated')
      .eq('device_uuid', device_uuid)
      .single();

    let deviceId: string;

    if (existingDevice) {
      // Update existing device
      deviceId = existingDevice.id;
      await supabase
        .from('devices')
        .update({
          model: model || null,
          manufacturer: manufacturer || null,
          os_version: os_version || null,
          player_version: player_version || null,
          resolution: resolution || null,
          is_activated: true,
          activation_code: activation_code.toUpperCase().trim(),
          status: 'active',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('id', deviceId);
    } else {
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
          activation_code: activation_code.toUpperCase().trim(),
          is_activated: true,
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          content_version: 0,
        })
        .select('id')
        .single();

      if (createError || !newDevice) {
        return NextResponse.json({ error: 'Erro ao criar dispositivo: ' + (createError?.message || 'unknown') }, { status: 500 });
      }

      deviceId = newDevice.id;
    }

    // Update activation code usage
    await supabase
      .from('activation_codes')
      .update({
        use_count: codeRecord.use_count + 1,
        device_id: deviceId,
        status: codeRecord.use_count + 1 >= codeRecord.max_uses ? 'used' : 'pending',
        used_at: new Date().toISOString(),
      })
      .eq('id', codeRecord.id);

    // Get server config for the device
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      device_id: deviceId,
      api_base_url: baseUrl,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      content_version: 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/device/activate error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
