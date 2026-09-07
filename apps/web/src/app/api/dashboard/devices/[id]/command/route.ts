import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

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

    const [device] = await sql`SELECT organization_id FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    await sql`
      INSERT INTO device_commands (device_id, command, payload, created_by)
      VALUES (${id}, ${command}, ${JSON.stringify(body.payload ?? {})}, ${user.id})
    `;

    return NextResponse.json({ success: true, command });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[device command]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
