import { NextRequest, NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getPartnerSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    let notifications;
    if (unreadOnly) {
      notifications = await sql`
        SELECT * FROM partner_notifications
        WHERE partner_access_id = ${session.partnerAccessId} AND read = false
        ORDER BY created_at DESC LIMIT 50
      `;
    } else {
      notifications = await sql`
        SELECT * FROM partner_notifications
        WHERE partner_access_id = ${session.partnerAccessId}
        ORDER BY created_at DESC LIMIT 50
      `;
    }

    const [unreadCount] = await sql`
      SELECT COUNT(*)::int as count FROM partner_notifications
      WHERE partner_access_id = ${session.partnerAccessId} AND read = false
    `;

    return NextResponse.json({
      notifications: notifications ?? [],
      unread_count: unreadCount?.count || 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPartnerSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (ids && ids.length > 0) {
      await sql`UPDATE partner_notifications SET read = true WHERE id = ANY(${ids}) AND partner_access_id = ${session.partnerAccessId}`;
    } else {
      await sql`UPDATE partner_notifications SET read = true WHERE partner_access_id = ${session.partnerAccessId} AND read = false`;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
