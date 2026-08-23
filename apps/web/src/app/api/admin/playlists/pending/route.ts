import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/playlists/pending - List pending playlists for approval
export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const supabase = getServiceClient();

    // Check user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    // Get pending playlists with items
    let query = supabase
      .from('playlists')
      .select(`
        *,
        parent:playlists!parent_id (id, name, version)
      `)
      .eq('approval_status', 'pending')
      .order('requested_at', { ascending: true });

    if (profile.role !== 'super_admin' && profile.organization_id) {
      query = query.eq('organization_id', profile.organization_id);
    }

    const { data: pendingPlaylists, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For each pending playlist, get its items
    const result = await Promise.all(
      (pendingPlaylists ?? []).map(async (pl) => {
        const { data: items } = await supabase
          .from('playlist_items')
          .select('*, media:media(id, name, type, file_url)')
          .eq('playlist_id', pl.id)
          .order('position', { ascending: true });

        // Get original playlist items for comparison
        let originalItems: unknown[] = [];
        if (pl.parent_id) {
          const { data: origItems } = await supabase
            .from('playlist_items')
            .select('*, media:media(id, name, type, file_url)')
            .eq('playlist_id', pl.parent_id)
            .order('position', { ascending: true });
          originalItems = origItems ?? [];
        }

        return {
          ...pl,
          items: items ?? [],
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
