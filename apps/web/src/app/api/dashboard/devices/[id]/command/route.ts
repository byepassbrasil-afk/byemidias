import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


// POST /api/dashboard/devices/[id]/command
// Body: { command: 'open_config' | 'rotate' | 'restart' | 'reload' | 'clear_cache' | 'rotate_portrait' | 'rotate_landscape' | 'toggle_kiosk' }
//
// Enfileira um comando para o device executar no próximo heartbeat.
// O device consulta /api/device/commands?device_id=X no heartbeat.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const command = body.command;

    const validCommands = [
      'open_config',
      'rotate',
      'rotate_portrait',
      'rotate_landscape',
      'restart',
      'reload',
      'clear_cache',
      'toggle_kiosk',
    ];
    if (!validCommands.includes(command)) {
      return NextResponse.json({ error: 'Comando inválido' }, { status: 400 });
    }

    const pb = await getAdminClient();
    const device = await pb.collection('devices').getOne(id);
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    try {
      const commandCollection = await pb.collections.getOne('device_commands');
      const commandFields = commandCollection.fields || commandCollection.schema || [];
      if (!commandFields.some((field: any) => field.name === 'executed_at')) {
        await pb.collections.update('device_commands', {
          fields: [
            ...commandFields,
            { name: 'executed_at', type: 'date' },
          ],
        });
      }
    } catch {
      await pb.collections.create({
        name: 'device_commands',
        type: 'base',
        fields: [
          { name: 'device_id', type: 'text', required: true },
          { name: 'command', type: 'text', required: true },
          { name: 'payload', type: 'json' },
          { name: 'created_by', type: 'text' },
          { name: 'executed_at', type: 'date' },
        ],
      });
    }

    await pb.collection('devices').update(id, { content_version: Date.now() });
    await pb.collection('device_commands').create({
      device_id: id,
      command,
      payload: body.payload || {},
      created_by: user.id,
    });

    try {
      await pb.collection('device_logs').create({
        device_id: id,
        organization_id: device.organization_id,
        event_type: 'webhook',
        message: `Webhook enviado: ${command}`,
        severity: 'info',
      });
    } catch {}

    return NextResponse.json({ success: true, command });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[device command]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
