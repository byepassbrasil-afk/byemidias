import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAuthApi } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const supabase = await createServerSupabase();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    let query = supabase
      .from('partner_access')
      .select(`
        id, username, display_name, status, created_at, updated_at,
        partner_devices (
          id, device_id, playlist_id,
          devices ( id, name, status ),
          playlists ( id, name )
        )
      `);

    if (profile.role !== 'super_admin' && profile.organization_id) {
      query = query.eq('organization_id', profile.organization_id);
    }

    const { data: partners, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ partners: partners ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/admin/partners error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const supabase = await createServerSupabase();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { username, display_name, password } = body;

    if (!username || !password || !display_name) {
      return NextResponse.json({ error: 'Campos obrigatórios: username, display_name, password' }, { status: 400 });
    }

    // Hash password
    let passwordHash: string | null = null;

    // Try pgcrypto RPC first
    try {
      const { data: hashResult } = await supabase.rpc('hash_partner_password', {
        p_password: password,
      });
      passwordHash = hashResult;
    } catch {
      // RPC may not work via pooler
    }

    // Fallback: bcryptjs
    if (!passwordHash) {
      const bcrypt = await import('bcryptjs');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const orgId = profile.role === 'super_admin' ? null : profile.organization_id;

    const { data: partner, error } = await supabase
      .from('partner_access')
      .insert({
        organization_id: orgId,
        username: username.toLowerCase().trim(),
        display_name: display_name.trim(),
        password_hash: passwordHash,
        status: 'active',
      })
      .select('id, username, display_name, status, created_at')
      .single();

    if (error) {
      console.error('Insert error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este nome de usuário já existe' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ partner });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/partners error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
