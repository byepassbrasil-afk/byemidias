import { NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/lp/[slug]/stats — Aggregated stats for an org's landing page
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [org] = await sql`
      SELECT id, name, tagline, primary_color, default_latitude, default_longitude
      FROM organizations WHERE slug = ${slug} LIMIT 1
    `;
    if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });

    const [stats] = await sql`
      SELECT
        COUNT(*)::int as total_devices,
        COUNT(*) FILTER (WHERE d.is_activated = true AND d.latitude IS NOT NULL)::int as visible_devices,
        COUNT(DISTINCT city) FILTER (WHERE city IS NOT NULL)::int as cities,
        COUNT(*) FILTER (WHERE d.last_heartbeat > NOW() - INTERVAL '5 minutes')::int as online_now
      FROM devices d
      WHERE d.organization_id = ${org.id}
    `;

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        tagline: org.tagline,
        primary_color: org.primary_color,
        default_latitude: org.default_latitude ? Number(org.default_latitude) : null,
        default_longitude: org.default_longitude ? Number(org.default_longitude) : null,
      },
      stats: stats ?? { total_devices: 0, visible_devices: 0, cities: 0, online_now: 0 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
