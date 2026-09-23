import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/reports/category-history — Histórico de filtragem por categoria
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const deviceId = searchParams.get('device_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let history;
    if (user.role === 'super_admin') {
      if (deviceId) {
        history = await sql`
          SELECT
            ch.id, ch.device_id, ch.media_id, ch.category_id,
            ch.action, ch.reason, ch.created_at,
            d.name AS device_name, d.establishment_name,
            m.name AS media_name,
            c.name AS category_name, c.color AS category_color
          FROM category_history ch
          INNER JOIN devices d ON d.id = ch.device_id
          INNER JOIN media m ON m.id = ch.media_id
          LEFT JOIN categories c ON c.id = ch.category_id
          WHERE ch.created_at >= ${sinceDate}
            AND ch.device_id = ${deviceId}
          ORDER BY ch.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        history = await sql`
          SELECT
            ch.id, ch.device_id, ch.media_id, ch.category_id,
            ch.action, ch.reason, ch.created_at,
            d.name AS device_name, d.establishment_name,
            m.name AS media_name,
            c.name AS category_name, c.color AS category_color
          FROM category_history ch
          INNER JOIN devices d ON d.id = ch.device_id
          INNER JOIN media m ON m.id = ch.media_id
          LEFT JOIN categories c ON c.id = ch.category_id
          WHERE ch.created_at >= ${sinceDate}
          ORDER BY ch.created_at DESC
          LIMIT ${limit}
        `;
      }
    } else {
      if (deviceId) {
        history = await sql`
          SELECT
            ch.id, ch.device_id, ch.media_id, ch.category_id,
            ch.action, ch.reason, ch.created_at,
            d.name AS device_name, d.establishment_name,
            m.name AS media_name,
            c.name AS category_name, c.color AS category_color
          FROM category_history ch
          INNER JOIN devices d ON d.id = ch.device_id
          INNER JOIN media m ON m.id = ch.media_id
          LEFT JOIN categories c ON c.id = ch.category_id
          WHERE ch.created_at >= ${sinceDate}
            AND ch.device_id = ${deviceId}
            AND d.organization_id = ${user.organization_id}
          ORDER BY ch.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        history = await sql`
          SELECT
            ch.id, ch.device_id, ch.media_id, ch.category_id,
            ch.action, ch.reason, ch.created_at,
            d.name AS device_name, d.establishment_name,
            m.name AS media_name,
            c.name AS category_name, c.color AS category_color
          FROM category_history ch
          INNER JOIN devices d ON d.id = ch.device_id
          INNER JOIN media m ON m.id = ch.media_id
          LEFT JOIN categories c ON c.id = ch.category_id
          WHERE ch.created_at >= ${sinceDate}
            AND d.organization_id = ${user.organization_id}
          ORDER BY ch.created_at DESC
          LIMIT ${limit}
        `;
      }
    }

    return NextResponse.json({ days, device_id: deviceId, history });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

