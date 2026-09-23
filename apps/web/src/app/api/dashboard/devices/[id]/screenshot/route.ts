import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


// POST /api/dashboard/devices/[id]/screenshot — Request device screenshot (org manager)
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
    const [device] = await sql`SELECT id, organization_id, name FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    await sql`UPDATE devices SET screenshot_requested = true, updated_at = NOW() WHERE id = ${id}`;

    return NextResponse.json({ success: true, message: 'Screenshot solicitado. Será capturado no próximo heartbeat.' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
