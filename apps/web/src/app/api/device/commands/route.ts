import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/device/commands?device_id=X
// Returns pending commands for the device and marks them as executed.
// Called by the device during heartbeat.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    if (!deviceId) {
      return NextResponse.json({ commands: [] });
    }

    // Buscar comandos pendentes
    const pending = await sql`
      SELECT id, command, payload, created_at
      FROM device_commands
      WHERE device_id = ${deviceId} AND executed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 10
    `;

    if (pending.length === 0) {
      return NextResponse.json({ commands: [] });
    }

    // Marcar como executados (acknowledged). O device vai limpar após ack.
    const ids = pending.map((c: any) => c.id);
    await sql`
      UPDATE device_commands
      SET executed_at = NOW()
      WHERE id = ANY(${ids})
    `;

    // Cleanup: deletar comandos antigos já executados (> 1 dia)
    await sql`
      DELETE FROM device_commands
      WHERE device_id = ${deviceId} AND executed_at < NOW() - INTERVAL '1 day'
    `;

    return NextResponse.json({
      commands: pending.map((c: any) => ({
        id: c.id,
        command: c.command,
        payload: typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload,
        created_at: c.created_at,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[device commands]', msg);
    return NextResponse.json({ error: msg, commands: [] }, { status: 500 });
  }
}
