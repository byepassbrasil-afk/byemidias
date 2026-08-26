import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request: Request) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { device_id, action } = body;

  if (!device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });

  if (action === 'start') {
    await sql`UPDATE devices SET live_watching = TRUE, screenshot_requested = TRUE WHERE id = ${device_id}`;
    return NextResponse.json({ ok: true, watching: true });
  }

  if (action === 'stop') {
    await sql`UPDATE devices SET live_watching = FALSE WHERE id = ${device_id}`;
    return NextResponse.json({ ok: true, watching: false });
  }

  return NextResponse.json({ error: 'action must be start or stop' }, { status: 400 });
}

export async function GET(request: Request) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');

  if (!deviceId) {
    const [result] = await sql`SELECT COUNT(*) as count FROM devices WHERE live_watching = TRUE`;
    return NextResponse.json({ active_count: parseInt(result?.count || '0') });
  }

  const [device] = await sql`
    SELECT id, name, last_screenshot, screenshot_updated_at, live_watching
    FROM devices WHERE id = ${deviceId}
  `;

  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  return NextResponse.json({
    watching: device.live_watching || false,
    frame: device.last_screenshot || null,
    frame_at: device.screenshot_updated_at || null,
    device_name: device.name || null,
  });
}
