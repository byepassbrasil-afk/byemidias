import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// POST /api/device/activate
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_uuid, activation_code, model, manufacturer, os_version, player_version, resolution } = body;

    if (!device_uuid || !activation_code) {
      return NextResponse.json({ error: 'device_uuid e activation_code obrigatórios' }, { status: 400 });
    }

    const code = activation_code.toUpperCase().trim();

    // Find activation code
    const [codeRecord] = await sql`SELECT * FROM activation_codes WHERE code = ${code}`;
    if (!codeRecord) {
      return NextResponse.json({ error: 'Código de ativação inválido' }, { status: 401 });
    }

    // Check expiration
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Código de ativação expirado' }, { status: 401 });
    }

    // Check if device already exists (by UUID)
    const [existingDevice] = await sql`SELECT id, is_activated, activation_code FROM devices WHERE device_uuid = ${device_uuid}`;

    if (existingDevice) {
      await sql`UPDATE devices SET model = ${model || null}, manufacturer = ${manufacturer || null}, os_version = ${os_version || null}, player_version = ${player_version || null}, resolution = ${resolution || null}, is_activated = true, activation_code = ${code}, status = 'online', last_heartbeat = NOW() WHERE id = ${existingDevice.id}`;
      return NextResponse.json({ device_id: existingDevice.id, recovered: true, content_version: 0 });
    }

    // Recovery: code already used → re-link device
    if (codeRecord.linked_device_id && codeRecord.use_count >= codeRecord.max_uses) {
      const [linkedDevice] = await sql`SELECT id FROM devices WHERE id = ${codeRecord.linked_device_id}`;
      if (linkedDevice) {
        await sql`UPDATE devices SET device_uuid = ${device_uuid}, model = ${model || null}, manufacturer = ${manufacturer || null}, os_version = ${os_version || null}, player_version = ${player_version || null}, resolution = ${resolution || null}, is_activated = true, activation_code = ${code}, status = 'online', last_heartbeat = NOW() WHERE id = ${linkedDevice.id}`;
        return NextResponse.json({ device_id: linkedDevice.id, recovered: true, content_version: 0 });
      }
    }

    // Check max_uses
    if (codeRecord.use_count >= codeRecord.max_uses) {
      return NextResponse.json({ error: 'Código de ativação atingiu o limite de uso' }, { status: 401 });
    }

    // Create new device
    const [newDevice] = await sql`INSERT INTO devices (device_uuid, organization_id, name, model, manufacturer, os_version, player_version, resolution, activation_code, is_activated, status, last_heartbeat, content_version) VALUES (${device_uuid}, ${codeRecord.organization_id}, ${`${manufacturer || 'Unknown'} ${model || 'Device'}`}, ${model || null}, ${manufacturer || null}, ${os_version || null}, ${player_version || null}, ${resolution || null}, ${code}, true, 'online', NOW(), 0) RETURNING id`;

    if (!newDevice) {
      return NextResponse.json({ error: 'Erro ao criar dispositivo' }, { status: 500 });
    }

    // Update activation code usage
    await sql`UPDATE activation_codes SET use_count = ${codeRecord.use_count + 1}, linked_device_id = ${newDevice.id}, status = ${codeRecord.use_count + 1 >= codeRecord.max_uses ? 'used' : 'active'} WHERE id = ${codeRecord.id}`;

    return NextResponse.json({ device_id: newDevice.id, recovered: false, content_version: 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
