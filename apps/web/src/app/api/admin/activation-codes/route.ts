import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/admin/activation-codes - List activation codes
export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    let query = supabase
      .from('activation_codes')
      .select('*, device:devices(id, name, status)')
      .order('created_at', { ascending: false });

    if (profile.role !== 'super_admin' && profile.organization_id) {
      query = query.eq('organization_id', profile.organization_id);
    }

    const { data: codes, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/activation-codes - Generate new activation code(s)
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { count = 1, organization_id, expires_at } = body;

    const orgId = profile.role === 'super_admin' ? (organization_id || null) : profile.organization_id;

    const codesToInsert = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      codesToInsert.push({
        code: generateCode(),
        organization_id: orgId,
        status: 'pending',
        max_uses: 1,
        use_count: 0,
        expires_at: expires_at || null,
        created_by: user.email || user.id,
      });
    }

    const { data: insertedCodes, error } = await supabase
      .from('activation_codes')
      .insert(codesToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ codes: insertedCodes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/activation-codes - Delete activation codes
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
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const { error } = await supabase
      .from('activation_codes')
      .delete()
      .eq('id', codeId)
      .eq('status', 'pending'); // Only delete unused codes

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
