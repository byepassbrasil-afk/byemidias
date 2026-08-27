import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    let data;
    if (campaignId) {
      data = await sql`SELECT * FROM campaign_time_slots WHERE campaign_id = ${campaignId} ORDER BY day_of_week, start_time`;
    } else if (isSuperAdmin) {
      data = await sql`SELECT * FROM campaign_time_slots ORDER BY day_of_week, start_time`;
    } else {
      data = await sql`
        SELECT cts.* FROM campaign_time_slots cts
        INNER JOIN campaigns c ON c.id = cts.campaign_id
        WHERE c.organization_id = ${orgId}
        ORDER BY cts.day_of_week, cts.start_time
      `;
    }

    return NextResponse.json({ slots: data ?? [] });
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
    const { campaign_id, day_of_week, start_time, end_time, playlist_id, priority } = body;

    if (!campaign_id || day_of_week == null || !start_time || !end_time) {
      return NextResponse.json({ error: 'Campos obrigatorios faltando' }, { status: 400 });
    }

    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin) {
      const [campaign] = await sql`SELECT organization_id FROM campaigns WHERE id = ${campaign_id}`;
      if (!campaign || campaign.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Campanha não encontrada ou sem permissão' }, { status: 404 });
      }
    }

    const [data] = await sql`
      INSERT INTO campaign_time_slots (campaign_id, day_of_week, start_time, end_time, playlist_id, priority)
      VALUES (${campaign_id}, ${day_of_week}, ${start_time}, ${end_time}, ${playlist_id || null}, ${priority || 0})
      RETURNING *
    `;

    return NextResponse.json({ slot: data });
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
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin) {
      const [slot] = await sql`SELECT campaign_id FROM campaign_time_slots WHERE id = ${id}`;
      if (!slot) return NextResponse.json({ error: 'Slot não encontrado' }, { status: 404 });
      const [campaign] = await sql`SELECT organization_id FROM campaigns WHERE id = ${slot.campaign_id}`;
      if (!campaign || campaign.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }
    }

    const [data] = await sql`UPDATE campaign_time_slots SET ${sql(updates)} WHERE id = ${id} RETURNING *`;

    return NextResponse.json({ slot: data });
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

    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin) {
      const [slot] = await sql`SELECT campaign_id FROM campaign_time_slots WHERE id = ${id}`;
      if (slot) {
        const [campaign] = await sql`SELECT organization_id FROM campaigns WHERE id = ${slot.campaign_id}`;
        if (campaign && campaign.organization_id !== user.organization_id) {
          return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }
      }
    }

    await sql`DELETE FROM campaign_time_slots WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
