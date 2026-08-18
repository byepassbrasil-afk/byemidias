import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/playlists/[id]/slots - List slots for a playlist
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { data: slots, error } = await supabase
      .from('playlist_slots')
      .select(`
        *,
        partner:partner_access(id, username, display_name)
      `)
      .eq('playlist_id', params.id)
      .order('slot_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ slots: slots ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/playlists/[id]/slots - Create a slot
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { partner_access_id, duration_seconds, slot_order } = await request.json();

    if (!partner_access_id || !duration_seconds) {
      return NextResponse.json({ error: 'partner_access_id e duration_seconds obrigatórios' }, { status: 400 });
    }

    // Get max slot_order if not provided
    let order = slot_order;
    if (order === undefined || order === null) {
      const { data: existing } = await supabase
        .from('playlist_slots')
        .select('slot_order')
        .eq('playlist_id', params.id)
        .order('slot_order', { ascending: false })
        .limit(1);
      order = (existing?.[0]?.slot_order ?? -1) + 1;
    }

    const { data: slot, error } = await supabase
      .from('playlist_slots')
      .insert({
        playlist_id: params.id,
        partner_access_id,
        slot_order: order,
        duration_seconds,
      })
      .select('*, partner:partner_access(id, username, display_name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um slot nesta posição' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ slot });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/playlists/[id]/slots - Update slot order or duration
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { slot_id, duration_seconds, slot_order } = await request.json();

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id obrigatório' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
    if (slot_order !== undefined) updateData.slot_order = slot_order;

    const { error } = await supabase
      .from('playlist_slots')
      .update(updateData)
      .eq('id', slot_id)
      .eq('playlist_id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/playlists/[id]/slots - Delete a slot
export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slot_id');

    if (!slotId) {
      return NextResponse.json({ error: 'slot_id obrigatório' }, { status: 400 });
    }

    // Delete items in this slot first
    await supabase.from('playlist_items').delete().eq('slot_id', slotId);

    // Delete the slot
    const { error } = await supabase.from('playlist_slots').delete().eq('id', slotId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
