import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/playlists/[id]/approve - Approve a pending playlist version
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
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

    const parentId = pendingPlaylist.parent_id;

    // If there's a parent, archive the old version
    if (parentId) {
      await supabase
        .from('playlists')
        .update({ status: 'inactive' })
        .eq('id', parentId);
    }

    // Approve the new version
    const { error: approveError } = await supabase
      .from('playlists')
      .update({
        approval_status: 'approved',
        approved_by: user.email || user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', playlistId);

    if (approveError) {
      return NextResponse.json({ error: approveError.message }, { status: 500 });
    }

    // Update partner_devices to point to the new approved version
    if (parentId) {
      await supabase
        .from('partner_devices')
        .update({ playlist_id: playlistId })
        .eq('playlist_id', parentId);
    }

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
