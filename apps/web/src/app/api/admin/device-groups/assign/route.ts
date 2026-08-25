import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { group_id, campaign_id } = body;

    if (!group_id) {
      return NextResponse.json({ error: 'group_id obrigatório' }, { status: 400 });
    }

    const members = await sql`SELECT device_id FROM device_group_members WHERE group_id = ${group_id}`;

    if (!members?.length) {
      return NextResponse.json({ error: 'Grupo sem dispositivos' }, { status: 400 });
    }

    const deviceIds = members.map(m => m.device_id);
    for (const deviceId of deviceIds) {
      await sql`UPDATE devices SET campaign_id = ${campaign_id || null} WHERE id = ${deviceId}`;
    }

    return NextResponse.json({ success: true, updated: deviceIds.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
