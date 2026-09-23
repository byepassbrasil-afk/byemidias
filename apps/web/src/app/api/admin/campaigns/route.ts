import { NextResponse, NextRequest } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

// Salvar campanha + playlists vinculadas de forma atômica
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const {
      name,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      priority,
      status,
      playlist_ids = [],
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const orgId = user.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 });
    }

    const pb = await getAdminClient();

    // 1. Cria a campanha
    const campaignData: any = {
      name,
      organization_id: orgId,
      description: description || '',
      start_date: start_date || null,
      end_date: end_date || null,
      start_time: start_time || null,
      end_time: end_time || null,
      priority: priority || 3,
      status: status || 'draft',
    };

    const campaign = await pb.collection('campaigns').create(campaignData);

    // 2. Cria os vínculos com playlists
    const links = [];
    for (let i = 0; i < playlist_ids.length; i++) {
      try {
        const link = await pb.collection('campaign_playlists').create({
          campaign_id: campaign.id,
          playlist_id: playlist_ids[i],
          position: i + 1,
        });
        links.push(link);
      } catch (e: any) {
        console.error('[campaigns POST] erro ao criar link:', e.message);
      }
    }

    return NextResponse.json({ success: true, campaign, links });
  } catch (e: any) {
    console.error('[campaigns POST] erro:', e.message, e.data);
    return NextResponse.json({ error: e.message, data: e.data }, { status: 500 });
  }
}

// Atualizar campanha + playlists vinculadas
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const {
      id,
      name,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      priority,
      status,
      playlist_ids,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();

    // Verificar permissão
    if (user.role !== 'super_admin') {
      const existing = await pb.collection('campaigns').getOne(id);
      if (existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    // 1. Atualiza a campanha
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;

    const campaign = await pb.collection('campaigns').update(id, updateData);

    // 2. Atualiza os vínculos de playlists
    if (Array.isArray(playlist_ids)) {
      // Remove os vínculos existentes
      const existingLinks = await pb.collection('campaign_playlists').getList(1, 500, {
        filter: `campaign_id = "${id}"`,
      });
      for (const link of existingLinks.items) {
        await pb.collection('campaign_playlists').delete(link.id);
      }

      // Cria os novos
      for (let i = 0; i < playlist_ids.length; i++) {
        await pb.collection('campaign_playlists').create({
          campaign_id: id,
          playlist_id: playlist_ids[i],
          position: i + 1,
        });
      }
    }

    return NextResponse.json({ success: true, campaign });
  } catch (e: any) {
    console.error('[campaigns PUT] erro:', e.message, e.data);
    return NextResponse.json({ error: e.message, data: e.data }, { status: 500 });
  }
}

// Deletar campanha + seus vínculos
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();

    if (user.role !== 'super_admin') {
      const existing = await pb.collection('campaigns').getOne(id);
      if (existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    // Remove todos os vínculos de playlists
    const links = await pb.collection('campaign_playlists').getList(1, 500, {
      filter: `campaign_id = "${id}"`,
    });
    for (const link of links.items) {
      await pb.collection('campaign_playlists').delete(link.id);
    }

    // Remove programações
    const timeSlots = await pb.collection('campaign_time_slots').getList(1, 500, {
      filter: `campaign_id = "${id}"`,
    });
    for (const slot of timeSlots.items) {
      await pb.collection('campaign_time_slots').delete(slot.id);
    }

    // Remove targets
    const targets = await pb.collection('campaign_targets').getList(1, 500, {
      filter: `campaign_id = "${id}"`,
    });
    for (const target of targets.items) {
      await pb.collection('campaign_targets').delete(target.id);
    }

    // Remove a campanha
    await pb.collection('campaigns').delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[campaigns DELETE] erro:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
