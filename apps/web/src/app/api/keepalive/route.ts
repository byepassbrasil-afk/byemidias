import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const startTime = Date.now();

    const [{ count }] = await sql`SELECT count(*) FROM devices`;

    await sql`INSERT INTO keepalive_log (checked_at, device_count, response_ms) VALUES (${new Date().toISOString()}, ${count || 0}, ${Date.now() - startTime})`;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await sql`DELETE FROM keepalive_log WHERE checked_at < ${thirtyDaysAgo.toISOString()}`;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      device_count: Number(count) || 0,
      response_ms: Date.now() - startTime,
      message: 'ByeMidias keepalive ping successful',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/keepalive error:', msg);
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
  }
}
