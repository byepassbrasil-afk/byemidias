import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';


// GET /api/dashboard/reports/category-filtration — Filtragem por categoria
// Mostra mídias bloqueadas por categoria e overrides ativos
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Top categorias bloqueadas (vinculadas em device_categories com is_blocked = TRUE)
    const topBlocked = user.role === 'super_admin'
      ? await sql`
          SELECT
            c.id, c.name, c.icon, c.color,
            COUNT(DISTINCT dc.device_id)::int AS device_count,
            (SELECT COUNT(*)::int FROM media_categories mc WHERE mc.category_id = c.id) AS media_count
          FROM device_categories dc
          INNER JOIN categories c ON c.id = dc.category_id
          WHERE dc.is_blocked = TRUE
          GROUP BY c.id
          ORDER BY device_count DESC
          LIMIT 10
        `
      : await sql`
          SELECT
            c.id, c.name, c.icon, c.color,
            COUNT(DISTINCT dc.device_id)::int AS device_count,
            (SELECT COUNT(*)::int FROM media_categories mc WHERE mc.category_id = c.id) AS media_count
          FROM device_categories dc
          INNER JOIN categories c ON c.id = dc.category_id
          INNER JOIN devices d ON d.id = dc.device_id
          WHERE dc.is_blocked = TRUE
            AND d.organization_id = ${user.organization_id}
          GROUP BY c.id
          ORDER BY device_count DESC
          LIMIT 10
        `;

    // Total de devices com pelo menos 1 categoria configurada
    const [devicesWithCats] = user.role === 'super_admin'
      ? await sql`
          SELECT COUNT(DISTINCT device_id)::int AS count FROM device_categories
        `
      : await sql`
          SELECT COUNT(DISTINCT dc.device_id)::int AS count
          FROM device_categories dc
          INNER JOIN devices d ON d.id = dc.device_id
          WHERE d.organization_id = ${user.organization_id}
        `;

    // Total de overrides ativos
    const totalOverrides = user.role === 'super_admin'
      ? await sql`
          SELECT COUNT(*)::int AS count FROM devices
          WHERE category_overrides != '{}'::jsonb
        `
      : await sql`
          SELECT COUNT(*)::int AS count FROM devices
          WHERE organization_id = ${user.organization_id}
            AND category_overrides != '{}'::jsonb
        `;

    // Total de mídias com categoria
    const totalMedias = user.role === 'super_admin'
      ? await sql`SELECT COUNT(DISTINCT media_id)::int AS count FROM media_categories`
      : await sql`
          SELECT COUNT(DISTINCT mc.media_id)::int AS count
          FROM media_categories mc
          INNER JOIN media m ON m.id = mc.media_id
          WHERE m.organization_id = ${user.organization_id}
        `;

    // Devices com mais categorias bloqueadas
    const topDevices = user.role === 'super_admin'
      ? await sql`
          SELECT
            d.id, d.name,
            COUNT(*) FILTER (WHERE dc.is_blocked = TRUE)::int AS blocked_count,
            COUNT(*) FILTER (WHERE dc.is_blocked = FALSE)::int AS allowed_count,
            COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(d.category_overrides)), 0)::int AS overrides_count
          FROM device_categories dc
          INNER JOIN devices d ON d.id = dc.device_id
          GROUP BY d.id, d.name, d.category_overrides
          ORDER BY blocked_count DESC
          LIMIT 10
        `
      : await sql`
          SELECT
            d.id, d.name,
            COUNT(*) FILTER (WHERE dc.is_blocked = TRUE)::int AS blocked_count,
            COUNT(*) FILTER (WHERE dc.is_blocked = FALSE)::int AS allowed_count,
            COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(d.category_overrides)), 0)::int AS overrides_count
          FROM device_categories dc
          INNER JOIN devices d ON d.id = dc.device_id
          WHERE d.organization_id = ${user.organization_id}
          GROUP BY d.id, d.name, d.category_overrides
          ORDER BY blocked_count DESC
          LIMIT 10
        `;

    return NextResponse.json({
      days,
      stats: {
        devices_with_categories: devicesWithCats?.count ?? 0,
        total_overrides: totalOverrides?.count ?? 0,
        total_medias_categorized: totalMedias?.count ?? 0,
      },
      top_blocked_categories: topBlocked,
      top_devices: topDevices,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

