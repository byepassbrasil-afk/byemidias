import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    let notifications;
    if (user.role === 'super_admin') {
      if (unreadOnly) {
        notifications = await sql`SELECT n.*, d.name as device_name FROM notifications n LEFT JOIN devices d ON d.id = n.device_id WHERE n.read = false ORDER BY n.created_at DESC LIMIT ${limit}`;
      } else {
        notifications = await sql`SELECT n.*, d.name as device_name FROM notifications n LEFT JOIN devices d ON d.id = n.device_id ORDER BY n.created_at DESC LIMIT ${limit}`;
      }
    } else {
      if (unreadOnly) {
        notifications = await sql`SELECT n.*, d.name as device_name FROM notifications n LEFT JOIN devices d ON d.id = n.device_id WHERE n.organization_id = ${user.organization_id} AND n.read = false ORDER BY n.created_at DESC LIMIT ${limit}`;
      } else {
        notifications = await sql`SELECT n.*, d.name as device_name FROM notifications n LEFT JOIN devices d ON d.id = n.device_id WHERE n.organization_id = ${user.organization_id} ORDER BY n.created_at DESC LIMIT ${limit}`;
      }
    }

    const [unreadCount] = user.role === 'super_admin'
      ? await sql`SELECT COUNT(*)::int as count FROM notifications WHERE read = false`
      : await sql`SELECT COUNT(*)::int as count FROM notifications WHERE organization_id = ${user.organization_id} AND read = false`;

    return NextResponse.json({ notifications, unread_count: unreadCount?.count || 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (ids && ids.length > 0) {
      await sql`UPDATE notifications SET read = true WHERE id = ANY(${ids})`;
    } else {
      if (user.role === 'super_admin') {
        await sql`UPDATE notifications SET read = true WHERE read = false`;
      } else {
        await sql`UPDATE notifications SET read = true WHERE organization_id = ${user.organization_id} AND read = false`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
