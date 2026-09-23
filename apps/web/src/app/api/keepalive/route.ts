import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET() {
  try {
    const startTime = Date.now();

    const pb = await getAdminClient();
    const devices = await pb.collection('devices').getList(1, 1, { perPage: 1 });
    const count = devices.totalItems || 0;

    // Log
    await pb.collection('keepalive_log').create({
      device_count: count,
      response_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Cleanup registros com mais de 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oldRecords = await pb.collection('keepalive_log').getList(1, 500, {
      filter: `timestamp < "${thirtyDaysAgo.toISOString()}"`,
    });
    for (const rec of oldRecords.items) {
      try {
        await pb.collection('keepalive_log').delete(rec.id);
      } catch {}
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      device_count: count,
      response_ms: Date.now() - startTime,
      message: 'ByeMidias keepalive ping successful',
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[keepalive]', msg);
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
  }
}
