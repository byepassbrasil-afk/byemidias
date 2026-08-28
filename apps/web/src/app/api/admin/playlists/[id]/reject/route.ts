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
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || null;

    const [pendingPlaylist] = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND approval_status = 'pending'`;

    if (!pendingPlaylist) {
      return NextResponse.json({ error: 'Playlist pendente não encontrada' }, { status: 404 });
    }

    await sql`DELETE FROM playlist_items WHERE playlist_id = ${playlistId}`;

    await sql`DELETE FROM playlists WHERE id = ${playlistId}`;

    bumpContentVersion(user.organization_id).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Playlist rejeitada',
      reason,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/playlists/[id]/reject error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
