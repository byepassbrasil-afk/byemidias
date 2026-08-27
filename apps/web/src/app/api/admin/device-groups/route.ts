import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const isSuperAdmin = user.role === 'super_admin';
    const orgId = user.organization_id;

    let groups;
    if (isSuperAdmin) {
      groups = await sql`
        SELECT dg.*,
          (SELECT json_agg(json_build_object(
            'id', dgm.id, 'device_id', dgm.device_id,
            'devices', (SELECT json_build_object('name', d.name, 'status', d.status, 'campaign_id', d.campaign_id) FROM devices d WHERE d.id = dgm.device_id)
          )) FROM device_group_members dgm WHERE dgm.group_id = dg.id) as device_group_members
        FROM device_groups dg
        ORDER BY dg.name
      `;
    } else {
      groups = await sql`
        SELECT dg.*,
          (SELECT json_agg(json_build_object(
            'id', dgm.id, 'device_id', dgm.device_id,
            'devices', (SELECT json_build_object('name', d.name, 'status', d.status, 'campaign_id', d.campaign_id) FROM devices d WHERE d.id = dgm.device_id)
          )) FROM device_group_members dgm WHERE dgm.group_id = dg.id) as device_group_members
        FROM device_groups dg
        WHERE dg.organization_id = ${orgId}
        ORDER BY dg.name
      `;
    }

    return NextResponse.json({ groups: groups || [] });
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
    const { name, description, device_ids } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 });

    const [group] = await sql`
      INSERT INTO device_groups (organization_id, name, description)
      VALUES (${orgId}, ${name}, ${description || null})
      RETURNING *
    `;

    if (device_ids?.length > 0) {
      for (const deviceId of device_ids) {
        await sql`INSERT INTO device_group_members (group_id, device_id) VALUES (${group.id}, ${deviceId})`;
      }
    }

    return NextResponse.json({ group });
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
    const { group_id, device_ids } = body;

    if (!group_id) return NextResponse.json({ error: 'group_id obrigatório' }, { status: 400 });

    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin) {
      const [existing] = await sql`SELECT organization_id FROM device_groups WHERE id = ${group_id}`;
      if (!existing || existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }
    }

    await sql`DELETE FROM device_group_members WHERE group_id = ${group_id}`;

    if (device_ids?.length > 0) {
      for (const deviceId of device_ids) {
        await sql`INSERT INTO device_group_members (group_id, device_id) VALUES (${group_id}, ${deviceId})`;
      }
    }

    return NextResponse.json({ success: true });
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
      await sql`DELETE FROM device_groups WHERE id = ${id}`;
    } else {
      await sql`DELETE FROM device_groups WHERE id = ${id} AND organization_id = ${user.organization_id}`;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
