import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// GET /api/map/[slug]/devices — Public devices of an org (only is_activated=true with coords)
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 });

    const [org] = await sql`
      SELECT id, name, address, city, state, default_latitude, default_longitude, primary_color
      FROM organizations WHERE slug = ${slug} LIMIT 1
    `;
    if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });

    const devices = await sql`
      SELECT
        d.id, d.name, d.latitude, d.longitude, d.address, d.city, d.state,
        pa.display_name as partner_name,
        pc.name as campaign_name
      FROM devices d
      LEFT JOIN partner_devices pdev ON pdev.device_id = d.id
      LEFT JOIN partner_access pa ON pa.id = pdev.partner_access_id
      LEFT JOIN campaigns c ON c.id = d.campaign_id
      LEFT JOIN playlists pl ON pl.id = c.id
      LEFT JOIN campaigns pc ON pc.id = c.id
      WHERE d.organization_id = ${org.id}
        AND d.is_activated = true
        AND d.latitude IS NOT NULL
        AND d.longitude IS NOT NULL
      ORDER BY d.name
    `;

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        primary_color: org.primary_color,
        default_latitude: org.default_latitude ? Number(org.default_latitude) : null,
        default_longitude: org.default_longitude ? Number(org.default_longitude) : null,
      },
      devices,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
