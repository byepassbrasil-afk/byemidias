import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getVapidPublicKey } from '@/lib/vapid';

// GET /api/push/vapid-key — Return VAPID public key
export async function GET() {
  try {
    return NextResponse.json({ publicKey: getVapidPublicKey() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/push/vapid-key — Return VAPID public key + check if user already subscribed
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    const publicKey = getVapidPublicKey();

    if (endpoint) {
      const [existing] = await sql`SELECT id FROM push_subscriptions WHERE endpoint = ${endpoint} LIMIT 1`;
      return NextResponse.json({ publicKey, subscribed: !!existing });
    }

    return NextResponse.json({ publicKey, subscribed: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
