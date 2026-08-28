import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const playlistId = params.id;

    const [pendingPlaylist] = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND approval_status = 'pending'`;

    if (!pendingPlaylist) {
      return NextResponse.json({ error: 'Playlist pendente não encontrada' }, { status: 404 });
    }

    const parentId = pendingPlaylist.parent_id;

    if (parentId) {
      await sql`UPDATE playlists SET status = 'inactive' WHERE id = ${parentId}`;
    }

    await sql`
      UPDATE playlists
      SET approval_status = 'approved', approved_by = ${user.email || user.id}, approved_at = ${new Date().toISOString()}
      WHERE id = ${playlistId}
    `;

    if (parentId) {
      await sql`UPDATE partner_devices SET playlist_id = ${playlistId} WHERE playlist_id = ${parentId}`;
    }

    if (user.organization_id) bumpContentVersion(user.organization_id).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Playlist aprovada com sucesso',
      version: pendingPlaylist.version,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/playlists/[id]/approve error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
