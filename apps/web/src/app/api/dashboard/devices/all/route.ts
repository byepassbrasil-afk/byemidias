import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/devices/all — List all devices for org manager
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let devices;
    if (user.role === 'super_admin') {
      if (status) {
        devices = await sql`SELECT * FROM devices WHERE status = ${status} ORDER BY name`;
      } else {
        devices = await sql`SELECT * FROM devices ORDER BY name`;
      }
    } else {
      if (status) {
        devices = await sql`SELECT * FROM devices WHERE organization_id = ${user.organization_id} AND status = ${status} ORDER BY name`;
      } else {
        devices = await sql`SELECT * FROM devices WHERE organization_id = ${user.organization_id} ORDER BY name`;
      }
    }

    return NextResponse.json({ data: devices });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

