import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let data;
    if (orgId) {
      data = await sql`SELECT * FROM layout_templates WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
    } else {
      data = await sql`SELECT * FROM layout_templates ORDER BY created_at DESC`;
    }

    // Ensure zones is always parsed as array
    const templates = (data || []).map((t: Record<string, unknown>) => ({
      ...t,
      zones: typeof t.zones === 'string' ? JSON.parse(t.zones as string) : t.zones || [],
    }));

    return NextResponse.json({ templates });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { name, description, width, height, zones, organization_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    let orgId = organization_id;
    if (!orgId) {
      const [org] = await sql`SELECT id FROM organizations LIMIT 1`;
      orgId = org?.id;
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 });
    }

    // Store zones as JSONB
    const [data] = await sql`
      INSERT INTO layout_templates (organization_id, name, description, width, height, zones)
      VALUES (${orgId}, ${name}, ${description || null}, ${width || 1920}, ${height || 1080}, ${JSON.stringify(zones || [])})
      RETURNING *
    `;

    return NextResponse.json({ template: { ...data, zones: typeof data.zones === 'string' ? JSON.parse(data.zones) : data.zones || [] } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, name, description, width, height, zones } = body;

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const [data] = await sql`
      UPDATE layout_templates
      SET name = ${name}, description = ${description || null}, width = ${width || 1920}, height = ${height || 1080}, zones = ${JSON.stringify(zones || [])}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ template: { ...data, zones: typeof data.zones === 'string' ? JSON.parse(data.zones) : data.zones || [] } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await sql`DELETE FROM layout_templates WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
