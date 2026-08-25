import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    const [device] = await sql`SELECT organization_id FROM devices WHERE id = ${deviceId}`;

    if (!device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    const campaigns = await sql`SELECT * FROM campaigns WHERE organization_id = ${device.organization_id} AND status = 'active'`;

    return NextResponse.json({ campaigns: campaigns ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/campaigns/active error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
