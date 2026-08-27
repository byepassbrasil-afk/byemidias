import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    const isSuperAdmin = user.role === 'super_admin';
    let logs;

    if (deviceId) {
      if (isSuperAdmin) {
        logs = await sql`SELECT dl.*, d.name as device_name FROM device_logs dl LEFT JOIN devices d ON d.id = dl.device_id WHERE dl.device_id = ${deviceId} ORDER BY dl.created_at DESC LIMIT ${limit}`;
      } else {
        logs = await sql`SELECT dl.*, d.name as device_name FROM device_logs dl LEFT JOIN devices d ON d.id = dl.device_id WHERE dl.device_id = ${deviceId} AND d.organization_id = ${user.organization_id} ORDER BY dl.created_at DESC LIMIT ${limit}`;
      }
    } else {
      if (isSuperAdmin) {
        logs = await sql`SELECT dl.*, d.name as device_name FROM device_logs dl LEFT JOIN devices d ON d.id = dl.device_id ORDER BY dl.created_at DESC LIMIT ${limit}`;
      } else {
        logs = await sql`SELECT dl.*, d.name as device_name FROM device_logs dl LEFT JOIN devices d ON d.id = dl.device_id WHERE d.organization_id = ${user.organization_id} ORDER BY dl.created_at DESC LIMIT ${limit}`;
      }
    }

    return NextResponse.json({ data: logs ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
