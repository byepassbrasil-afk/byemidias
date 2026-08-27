import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// POST /api/push/subscribe — Register push subscription
export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 });
    }

    // Upsert subscription (same endpoint = same browser tab)
    await sql`
      INSERT INTO push_subscriptions (user_id, organization_id, endpoint, p256dh_key, auth_key)
      VALUES (${user.id}, ${user.organization_id}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = ${user.id},
        organization_id = ${user.organization_id},
        p256dh_key = ${keys.p256dh},
        auth_key = ${keys.auth},
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/push/subscribe error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/push/subscribe — Remove push subscription
export async function DELETE(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    } else {
      // Remove all subscriptions for this user
      await sql`DELETE FROM push_subscriptions WHERE user_id = ${user.id}`;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
