import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/folders?organization_id=xxx — list folders for an org (tree-friendly)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organization_id') || user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    // Non-super_admin só pode ver folders da própria org
    if (user.role !== 'super_admin' && orgId !== user.organization_id) {
      return NextResponse.json({ error: 'Acesso negado a essa organização' }, { status: 403 });
    }

    const pb = await getAdminClient();
    const filter = `organization_id = "${orgId}"`;
    const items = await pb.collection('media_folders').getFullList({
      filter,
      sort: 'order,name',
    });

    // Conta mídias por folder (1 query por folder seria caro — vamos usar full list + groupBy)
    const media = await pb.collection('media').getFullList({
      filter: `organization_id = "${orgId}"`,
      fields: 'folder_id',
    }).catch(() => []);
    const counts: Record<string, number> = {};
    for (const m of media) {
      if (m.folder_id) counts[m.folder_id] = (counts[m.folder_id] || 0) + 1;
    }

    const folders = items.map(f => ({
      id: f.id,
      organization_id: f.organization_id,
      name: f.name,
      parent_id: f.parent_id || null,
      color: f.color || '#3b82f6',
      icon: f.icon || '📁',
      order: f.order || 0,
      created_by: f.created_by || null,
      media_count: counts[f.id] || 0,
    }));

    return NextResponse.json({ folders });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[folders GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/folders — create
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { organization_id, name, parent_id, color, icon, order } = body;
    if (!organization_id || !name) {
      return NextResponse.json({ error: 'organization_id e name são obrigatórios' }, { status: 400 });
    }

    if (user.role !== 'super_admin' && organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Acesso negado a essa organização' }, { status: 403 });
    }

    const pb = await getAdminClient();

    // Verify parent folder belongs to same org (segurança)
    if (parent_id) {
      try {
        const parent = await pb.collection('media_folders').getOne(parent_id);
        if (parent.organization_id !== organization_id) {
          return NextResponse.json({ error: 'Pasta pai pertence a outra organização' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Pasta pai não encontrada' }, { status: 400 });
      }
    }

    const folder = await pb.collection('media_folders').create({
      organization_id,
      name: String(name).trim().substring(0, 100),
      parent_id: parent_id || null,
      color: color || '#3b82f6',
      icon: icon || '📁',
      order: typeof order === 'number' ? order : 0,
      created_by: user.email || user.id,
    });

    return NextResponse.json({ folder });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[folders POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/folders — update (name, color, icon, parent, order)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const pb = await getAdminClient();
    const folder = await pb.collection('media_folders').getOne(id);

    // Permission: same org or super_admin
    if (user.role !== 'super_admin' && folder.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const clean: any = {};
    if (typeof updates.name === 'string') clean.name = updates.name.trim().substring(0, 100);
    if (typeof updates.color === 'string') clean.color = updates.color.substring(0, 20);
    if (typeof updates.icon === 'string') clean.icon = updates.icon.substring(0, 10);
    if ('parent_id' in updates) clean.parent_id = updates.parent_id || null;
    if (typeof updates.order === 'number') clean.order = updates.order;

    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const updated = await pb.collection('media_folders').update(id, clean);
    return NextResponse.json({ folder: updated });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[folders PUT]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/folders?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const moveTo = searchParams.get('move_to') || ''; // pasta destino (vazio = raiz)
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const pb = await getAdminClient();
    const folder = await pb.collection('media_folders').getOne(id);

    if (user.role !== 'super_admin' && folder.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Move all media in this folder to the destination (or null = raiz)
    const mediaList = await pb.collection('media').getFullList({
      filter: `folder_id = "${id}"`,
    });
    for (const m of mediaList) {
      await pb.collection('media').update(m.id, { folder_id: moveTo || null });
    }

    // Move child folders to root (ou recursivo seria melhor, mas simplificamos)
    const children = await pb.collection('media_folders').getFullList({
      filter: `parent_id = "${id}"`,
    });
    for (const c of children) {
      await pb.collection('media_folders').update(c.id, { parent_id: null });
    }

    await pb.collection('media_folders').delete(id);
    return NextResponse.json({ success: true, moved_media: mediaList.length });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[folders DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
