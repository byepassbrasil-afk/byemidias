import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


// DELETE /api/dashboard/devices/[id]/overrides/[media_id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; media_id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id, media_id } = await params;

    const [device] = await sql`SELECT organization_id, category_overrides FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const overrides = { ...(device.category_overrides ?? {}) } as Record<string, any>;
    if (!(media_id in overrides)) {
      return NextResponse.json({ error: 'Override não encontrado' }, { status: 404 });
    }
    delete overrides[media_id];

    await sql.unsafe(
      `UPDATE devices SET category_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [overrides, id]
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
