import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let groups;
    if (orgId) {
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
    } else {
      groups = await sql`
        SELECT dg.*,
          (SELECT json_agg(json_build_object(
            'id', dgm.id, 'device_id', dgm.device_id,
            'devices', (SELECT json_build_object('name', d.name, 'status', d.status, 'campaign_id', d.campaign_id) FROM devices d WHERE d.id = dgm.device_id)
          )) FROM device_group_members dgm WHERE dgm.group_id = dg.id) as device_group_members
        FROM device_groups dg
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
    const body = await request.json();
    const { name, description, device_ids, organization_id } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    let orgId = organization_id;
    if (!orgId) {
      const [org] = await sql`SELECT id FROM organizations LIMIT 1`;
      orgId = org?.id;
    }

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
    const body = await request.json();
    const { group_id, device_ids } = body;

    if (!group_id) {
      return NextResponse.json({ error: 'group_id obrigatório' }, { status: 400 });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await sql`DELETE FROM device_groups WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
