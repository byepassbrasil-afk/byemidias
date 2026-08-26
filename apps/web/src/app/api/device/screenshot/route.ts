import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, screenshot } = body;

    if (!device_id || !screenshot) {
      return NextResponse.json({ error: 'device_id and screenshot required' }, { status: 400 });
    }

    await sql`
      UPDATE devices SET
        last_screenshot = ${screenshot},
        screenshot_updated_at = NOW()
      WHERE id = ${device_id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');

    if (!deviceId) {
      const devices = await sql`
        SELECT id, name, last_screenshot, screenshot_updated_at
        FROM devices
        WHERE last_screenshot IS NOT NULL
        ORDER BY screenshot_updated_at DESC
      `;
      return NextResponse.json({ devices });
    }

    const [device] = await sql`
      SELECT id, name, last_screenshot, screenshot_updated_at
      FROM devices WHERE id = ${deviceId}
    `;

    return NextResponse.json({ device: device || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
