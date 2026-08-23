import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/layouts
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = supabase
      .from('layout_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (orgId) query = query.eq('organization_id', orgId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ templates: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/layouts
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { name, description, width, height, zones, organization_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    // Get first org if not specified
    let orgId = organization_id;
    if (!orgId) {
      const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      orgId = orgs?.[0]?.id;
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('layout_templates')
      .insert({
        organization_id: orgId,
        name,
        description: description || null,
        width: width || 1920,
        height: height || 1080,
        zones: zones || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/layouts?id=X
export async function DELETE(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const { error } = await supabase.from('layout_templates').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
