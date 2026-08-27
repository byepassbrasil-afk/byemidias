import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    let schedules;
    if (isSuperAdmin) {
      schedules = await sql`SELECT cs.* FROM content_schedules cs ORDER BY cs.created_at DESC`;
    } else {
      schedules = await sql`SELECT cs.* FROM content_schedules cs WHERE cs.organization_id = ${orgId} ORDER BY cs.created_at DESC`;
    }

    let groups;
    if (isSuperAdmin) {
      groups = await sql`SELECT dg.*, (SELECT count(*) FROM device_group_members WHERE group_id = dg.id) as member_count FROM device_groups dg ORDER BY dg.name`;
    } else {
      groups = await sql`SELECT dg.*, (SELECT count(*) FROM device_group_members WHERE group_id = dg.id) as member_count FROM device_groups dg WHERE dg.organization_id = ${orgId} ORDER BY dg.name`;
    }

    return NextResponse.json({ schedules: schedules || [], groups: groups || [] });
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
    const { name, description, schedule_type, interval_minutes, days_of_week, start_time, end_time, start_date, end_date } = body;

    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 });

    const [data] = await sql`
      INSERT INTO content_schedules (organization_id, name, description, schedule_type, interval_minutes, days_of_week, start_time, end_time, start_date, end_date)
      VALUES (${orgId}, ${name}, ${description || null}, ${schedule_type || 'periodic'}, ${interval_minutes || 15}, ${days_of_week || '1,2,3,4,5,6,7'}, ${start_time || '00:00'}, ${end_time || '23:59'}, ${start_date || null}, ${end_date || null})
      RETURNING *
    `;

    return NextResponse.json({ schedule: data });
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
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const isSuperAdmin = user.role === 'super_admin';
    if (isSuperAdmin) {
      await sql`DELETE FROM content_schedules WHERE id = ${id}`;
    } else {
      await sql`DELETE FROM content_schedules WHERE id = ${id} AND organization_id = ${user.organization_id}`;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
