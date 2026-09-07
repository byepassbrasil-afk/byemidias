import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/debug/devices - direct debug endpoint for devices
export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    let devices;
    if (user.role === 'super_admin') {
      devices = await sql`SELECT id, name, organization_id, last_heartbeat FROM devices ORDER BY created_at DESC LIMIT 50`;
    } else {
      devices = await sql`SELECT id, name, organization_id, last_heartbeat FROM devices WHERE organization_id = ${user.organization_id} ORDER BY created_at DESC LIMIT 50`;
    }

    return NextResponse.json({
      debug: true,
      user_role: user.role,
      user_org_id: user.organization_id,
      devices_count: devices.length,
      devices: devices.slice(0, 3),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
