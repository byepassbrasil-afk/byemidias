import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


// POST /api/dashboard/devices/[id]/restart — Request device restart (org manager)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Check device exists and belongs to user's org
    const [device] = await sql`SELECT id, organization_id, name FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Set restart_requested = true; the device will pick this up on next heartbeat
    await sql`UPDATE devices SET restart_requested = true, updated_at = NOW() WHERE id = ${id}`;

    // Log it
    const logMessage = `Reinício solicitado pelo gestor ${user.email}`;
    await sql`
      INSERT INTO device_logs (device_id, event_type, severity, message)
      VALUES (${id}, 'restart', 'info', ${logMessage})
    `;

    return NextResponse.json({ success: true, message: 'Reinício solicitado. Será executado no próximo heartbeat.' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
