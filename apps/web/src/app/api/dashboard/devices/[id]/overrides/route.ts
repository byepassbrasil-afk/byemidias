import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/devices/[id]/overrides — list manual overrides for device
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

    const [device] = await sql`SELECT organization_id, category_overrides FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    let overridesRaw = device.category_overrides ?? {};
    let overrides: Record<string, any> = {};
    if (typeof overridesRaw === 'string') {
      try { overrides = JSON.parse(overridesRaw); } catch { overrides = {}; }
    } else if (typeof overridesRaw === 'object') {
      overrides = { ...overridesRaw };
    }
    const entries = Object.entries(overrides).map(([mediaId, val]) => ({
      media_id: mediaId,
      force_show: val.force_show ?? false,
      reason: val.reason ?? '',
      by_user: val.by_user ?? null,
      at: val.at ?? null,
    }));

    // Busca nomes das mídias para exibir
    const mediaIds = entries.map(e => e.media_id);
    let mediaMap: Record<string, { name: string; file_url: string }> = {};
    if (mediaIds.length > 0) {
      const medias = await sql`
        SELECT id, name, file_url FROM media WHERE id = ANY(${mediaIds})
      `;
      mediaMap = Object.fromEntries((medias as Array<any>).map(m => [m.id, m]));
    }

    return NextResponse.json({
      overrides: entries.map(e => ({
        ...e,
        media_name: mediaMap[e.media_id]?.name || 'Mídia removida',
        media_url: mediaMap[e.media_id]?.file_url || null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dashboard/devices/[id]/overrides — add or update override
// Body: { media_id, force_show: bool, reason }
export async function POST(
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
    const { media_id, force_show, reason } = body;

    if (!media_id) return NextResponse.json({ error: 'media_id obrigatório' }, { status: 400 });
    if (typeof force_show !== 'boolean') return NextResponse.json({ error: 'force_show deve ser bool' }, { status: 400 });
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Motivo obrigatório (mín 5 caracteres)' }, { status: 400 });
    }

    const [device] = await sql`SELECT organization_id, category_overrides FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    let overrides: Record<string, any> = {};
    if (device.category_overrides) {
      if (typeof device.category_overrides === 'string') {
        try { overrides = JSON.parse(device.category_overrides); } catch { overrides = {}; }
      } else {
        overrides = { ...device.category_overrides };
      }
    }
    overrides[media_id] = {
      force_show,
      reason: reason.trim(),
      by_user: user.id,
      at: new Date().toISOString(),
    };

    // postgres.js serializa objetos JS para jsonb automaticamente quando se passa direto
    await sql.unsafe(
      `UPDATE devices SET category_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [overrides, id]
    );

    return NextResponse.json({ success: true, override: overrides[media_id] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/dashboard/devices/[id]/overrides/[media_id] — remove override
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; media_id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id, media_id } = await params;

    const [device] = await sql`SELECT organization_id, category_overrides FROM devices WHERE id = ${id}`;
    if (!device) return NextResponse.json({ error: 'Device não encontrado' }, { status: 404 });
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    let overridesRaw = device.category_overrides ?? {};
    let overrides: Record<string, any> = {};
    if (typeof overridesRaw === 'string') {
      try { overrides = JSON.parse(overridesRaw); } catch { overrides = {}; }
    } else if (typeof overridesRaw === 'object') {
      overrides = { ...overridesRaw };
    }
    if (!(media_id in overrides)) {
      return NextResponse.json({ error: 'Override não encontrado' }, { status: 404 });
    }
    delete overrides[media_id];

    await sql.unsafe(
      `UPDATE devices SET category_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [overrides, id]
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
