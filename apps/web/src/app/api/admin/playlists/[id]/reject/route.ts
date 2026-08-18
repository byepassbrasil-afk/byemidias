import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/playlists/[id]/reject - Reject a pending playlist version
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    // Check user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const playlistId = params.id;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || null;

    // Get the pending playlist
    const { data: pendingPlaylist, error: fetchError } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .eq('approval_status', 'pending')
      .single();

    if (fetchError || !pendingPlaylist) {
      return NextResponse.json({ error: 'Playlist pendente não encontrada' }, { status: 404 });
    }

    // Delete items from the rejected version
    await supabase.from('playlist_items').delete().eq('playlist_id', playlistId);

    // Delete the rejected playlist
    const { error: deleteError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

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
