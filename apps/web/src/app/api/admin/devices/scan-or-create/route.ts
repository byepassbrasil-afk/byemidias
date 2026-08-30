import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await request.json();
    const { device_uuid, model } = body;

    if (!device_uuid) {
      return NextResponse.json({ error: 'device_uuid obrigatório' }, { status: 400 });
    }

    // 1. Check if device already exists by UUID
    const [existing] = await sql`
      SELECT id, organization_id, status FROM devices WHERE device_uuid = ${device_uuid} LIMIT 1
    `;

    if (existing) {
      return NextResponse.json({
        device: existing,
        created: false,
      });
    }

    // 2. Determine which organization the device belongs to
    let orgId = body.organization_id || user.organization_id;
    if (!orgId) {
      // super_admin scanning without specifying org — pick first org
      const [firstOrg] = await sql`SELECT id FROM organizations LIMIT 1`;
      orgId = firstOrg?.id;
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Nenhuma organização disponível' }, { status: 400 });
    }

    // 3. Create the device (same logic as activation API)
    const deviceId = randomUUID();
    const [created] = await sql`
      INSERT INTO devices (
        id, organization_id, name, model, status, is_activated,
        device_uuid, content_version, last_heartbeat, support_type,
        created_at, updated_at
      )
      VALUES (
        ${deviceId}, ${orgId},
        ${`Device ${device_uuid.take(8)}`},
        ${model || null},
        'inactive', false, ${device_uuid}, 0, null, 'anydesk',
        NOW(), NOW()
      )
      RETURNING id, organization_id, name, status, is_activated, device_uuid, created_at
    `;

    return NextResponse.json({
      device: created,
      created: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Scan-or-create device error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
