import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/debug/sync?device_id=X
// Returns the EXACT JSON the device would receive, plus diagnostic info.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    if (!deviceId) return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });

    const [device] = await sql`
      SELECT id, organization_id, campaign_id, orientation, content_version,
             category_overrides, screen_rotation
      FROM devices WHERE id = ${deviceId}
    `;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });

    const diag: Record<string, unknown> = {
      device: {
        id: device.id,
        orientation: device.orientation,
        campaign_id: device.campaign_id,
      },
    };

    if (!device.campaign_id) {
      diag.problem = 'Device não tem campaign_id vinculado';
      return NextResponse.json({ diag });
    }

    const [campaign] = await sql`SELECT id, name, status, start_date, end_date FROM campaigns WHERE id = ${device.campaign_id}`;
    diag.campaign = campaign;
    if (!campaign) {
      diag.problem = 'Campaign não encontrada';
      return NextResponse.json({ diag });
    }
    if (campaign.status !== 'active') {
      diag.problem = `Campaign status=${campaign.status} (precisa ser 'active')`;
      return NextResponse.json({ diag });
    }

    // Verifica datas
    const now = new Date();
    if (campaign.start_date && now < new Date(campaign.start_date)) {
      diag.problem = `Campaign start_date=${campaign.start_date} ainda não chegou`;
      return NextResponse.json({ diag });
    }
    if (campaign.end_date && now > new Date(campaign.end_date)) {
      diag.problem = `Campaign end_date=${campaign.end_date} já passou`;
      return NextResponse.json({ diag });
    }

    // Playlists
    const campaignPlaylists = await sql`
      SELECT cp.playlist_id, cp.position, p.name as playlist_name
      FROM campaign_playlists cp
      JOIN playlists p ON p.id = cp.playlist_id
      WHERE cp.campaign_id = ${campaign.id}
      ORDER BY cp.position ASC
    `;
    diag.campaign_playlists = campaignPlaylists;
    if (campaignPlaylists.length === 0) {
      diag.problem = 'Campaign não tem playlists vinculadas';
      return NextResponse.json({ diag });
    }

    // Items por playlist
    const playlistDetails: any[] = [];
    for (const cp of campaignPlaylists) {
      const items = await sql`
        SELECT pi.id, pi.position, pi.media_id, pi.slot_id, pi.duration,
               m.name as media_name, m.file_url, m.status, m.expires_at
        FROM playlist_items pi
        LEFT JOIN media m ON m.id = pi.media_id
        WHERE pi.playlist_id = ${cp.playlist_id}
        ORDER BY pi.position ASC
      `;
      playlistDetails.push({
        playlist_id: cp.playlist_id,
        playlist_name: cp.playlist_name,
        item_count: items.length,
        items: items.map((i: any) => ({
          media_id: i.media_id,
          media_name: i.media_name,
          media_status: i.status,
          media_expires_at: i.expires_at,
          media_url_ok: !!i.file_url,
        })),
      });
    }
    diag.playlists = playlistDetails;

    // Categorias do device
    const deviceCategories = await sql`
      SELECT dc.category_id, dc.is_blocked, c.name as category_name
      FROM device_categories dc
      LEFT JOIN categories c ON c.id = dc.category_id
      WHERE dc.device_id = ${deviceId}
    `;
    diag.device_categories = deviceCategories;

    // Categorias dos itens
    const allMediaIds = new Set<string>();
    for (const pl of playlistDetails) {
      for (const i of pl.items) {
        if (i.media_id) allMediaIds.add(i.media_id);
      }
    }
    if (allMediaIds.size > 0) {
      const mediaCats = await sql`
        SELECT media_id, category_id, c.name as category_name
        FROM media_categories mc
        LEFT JOIN categories c ON c.id = mc.category_id
        WHERE media_id = ANY(${Array.from(allMediaIds)})
      `;
      diag.media_categories = mediaCats;

      // Verifica se algum item seria bloqueado
      const blockedCats = new Set(
        deviceCategories.filter((dc: any) => dc.is_blocked).map((dc: any) => dc.category_id)
      );
      const blockedMedia: any[] = [];
      for (const mc of mediaCats as any[]) {
        if (blockedCats.has(mc.category_id)) {
          blockedMedia.push({
            media_id: mc.media_id,
            category: mc.category_name,
            reason: 'categoria bloqueada',
          });
        }
      }
      diag.blocked_media = blockedMedia;
    }

    return NextResponse.json({ diag });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[debug/sync]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
