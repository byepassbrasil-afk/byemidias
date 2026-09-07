import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/devices/[id]/categories — list device's allowed/blocked categories
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Verifica permissão no device
    const [device] = await sql`SELECT organization_id FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Categorias atribuídas ao device (com flag is_blocked)
    const assigned = await sql`
      SELECT
        dc.category_id, dc.is_blocked, dc.created_at,
        c.name, c.slug, c.icon, c.color, c.description, c.is_default,
        (c.organization_id IS NULL) AS is_global
      FROM device_categories dc
      INNER JOIN categories c ON c.id = dc.category_id
      WHERE dc.device_id = ${id}
      ORDER BY dc.is_blocked ASC, c.name
    `;

    // Categorias disponíveis para atribuição (todas da org + globais, que ainda não estão no device)
    const available = await sql`
      SELECT
        c.id, c.name, c.slug, c.icon, c.color, c.description, c.is_default,
        (c.organization_id IS NULL) AS is_global
      FROM categories c
      WHERE (c.organization_id IS NULL OR c.organization_id = ${device.organization_id})
        AND NOT EXISTS (
          SELECT 1 FROM device_categories dc
          WHERE dc.device_id = ${id} AND dc.category_id = c.id
        )
      ORDER BY c.is_default DESC, c.name
    `;

    return NextResponse.json({ assigned, available });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/dashboard/devices/[id]/categories — bulk set device categories
// Body: { items: [{ category_id, is_blocked }] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const items: Array<{ category_id: string; is_blocked: boolean }> = body.items ?? [];

    // Verifica permissão no device
    const [device] = await sql`SELECT organization_id FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Valida que todas as categorias são acessíveis (da org ou globais)
    if (items.length > 0) {
      const catIds = items.map(i => i.category_id);
      const cats = await sql`
        SELECT id, organization_id FROM categories WHERE id = ANY(${catIds})
      `;
      for (const cat of cats) {
        if (cat.organization_id !== null && cat.organization_id !== device.organization_id) {
          return NextResponse.json({ error: 'Categoria não pertence à org' }, { status: 400 });
        }
      }
    }

    // Substitui tudo: apaga e recria
    await sql`DELETE FROM device_categories WHERE device_id = ${id}`;

    if (items.length > 0) {
      for (const item of items) {
        await sql.unsafe(
          `INSERT INTO device_categories (device_id, category_id, is_blocked)
           VALUES ($1, $2, $3)
           ON CONFLICT (device_id, category_id) DO UPDATE SET is_blocked = EXCLUDED.is_blocked`,
          [id, item.category_id, item.is_blocked]
        );
      }
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[device categories PUT]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
