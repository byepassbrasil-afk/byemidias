import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    let data;
    if (campaignId) {
      data = await sql`SELECT * FROM campaign_time_slots WHERE campaign_id = ${campaignId} ORDER BY day_of_week, start_time`;
    } else {
      data = await sql`SELECT * FROM campaign_time_slots ORDER BY day_of_week, start_time`;
    }

    return NextResponse.json({ slots: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaign_id, day_of_week, start_time, end_time, playlist_id, priority } = body;

    if (!campaign_id || day_of_week == null || !start_time || !end_time) {
      return NextResponse.json({ error: 'Campos obrigatorios faltando' }, { status: 400 });
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
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const [data] = await sql`UPDATE campaign_time_slots SET ${sql(updates)} WHERE id = ${id} RETURNING *`;

    return NextResponse.json({ slot: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    await sql`DELETE FROM campaign_time_slots WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
