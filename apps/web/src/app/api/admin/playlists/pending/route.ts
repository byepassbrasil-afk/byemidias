import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role, organization_id FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    let pendingPlaylists;
    if (profile.role !== 'super_admin' && profile.organization_id) {
      pendingPlaylists = await sql`
        SELECT pl.*,
          (SELECT row_to_json(p) FROM (SELECT id, name, version FROM playlists WHERE id = pl.parent_id) p) as parent
        FROM playlists pl
        WHERE pl.approval_status = 'pending' AND pl.organization_id = ${profile.organization_id}
        ORDER BY pl.requested_at ASC
      `;
    } else {
      pendingPlaylists = await sql`
        SELECT pl.*,
          (SELECT row_to_json(p) FROM (SELECT id, name, version FROM playlists WHERE id = pl.parent_id) p) as parent
        FROM playlists pl
        WHERE pl.approval_status = 'pending'
        ORDER BY pl.requested_at ASC
      `;
    }

    const result = await Promise.all(
      Array.from(pendingPlaylists ?? []).map(async (pl) => {
        const items = await sql`
          SELECT pi.*, row_to_json(m.*) as media
          FROM playlist_items pi
          LEFT JOIN media m ON m.id = pi.media_id
          WHERE pi.playlist_id = ${pl.id}
          ORDER BY pi.position ASC
        `;

        let originalItems: unknown[] = [];
        if (pl.parent_id) {
          const origResult = await sql`
            SELECT pi.*, row_to_json(m.*) as media
            FROM playlist_items pi
            LEFT JOIN media m ON m.id = pi.media_id
            WHERE pi.playlist_id = ${pl.parent_id}
            ORDER BY pi.position ASC
          `;
          originalItems = Array.from(origResult);
        }

        return {
          ...pl,
          items: Array.from(items) ?? [],
          original_items: originalItems,
        };
      })
    );

    return NextResponse.json({ playlists: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/admin/playlists/pending error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
