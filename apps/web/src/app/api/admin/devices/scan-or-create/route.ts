import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

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
      SELECT id, organization_id, status, is_activated FROM devices WHERE device_uuid = ${device_uuid} LIMIT 1
    `;

    if (existing) {
      // If not yet activated, activate it now (idempotent)
      if (!existing.is_activated) {
        const code = generateActivationCode();
        await sql`
          UPDATE devices SET is_activated = true, activation_code = ${code}, status = 'online',
            last_heartbeat = NOW(), model = COALESCE(${model || null}, model)
          WHERE id = ${existing.id}
        `;
      }
      const [updated] = await sql`SELECT id, organization_id, status, is_activated FROM devices WHERE id = ${existing.id}`;
      return NextResponse.json({
        device: updated,
        created: false,
        activated: true,
      });
    }

    // 2. Determine which organization the device belongs to
    let orgId = body.organization_id || user.organization_id;
    if (!orgId) {
      const [firstOrg] = await sql`SELECT id FROM organizations LIMIT 1`;
      orgId = firstOrg?.id;
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Nenhuma organização disponível' }, { status: 400 });
    }

    // 3. Create the device AND activate it in one step (auto-activate via scan)
    const deviceId = randomUUID();
    const code = generateActivationCode();
    const [created] = await sql`
      INSERT INTO devices (
        id, organization_id, name, model, status, is_activated,
        device_uuid, activation_code, content_version, last_heartbeat, support_type,
        created_at, updated_at
      )
      VALUES (
        ${deviceId}, ${orgId},
        ${`Device ${device_uuid.take(8)}`},
        ${model || null},
        'online', true, ${device_uuid}, ${code}, 0, NOW(), 'anydesk',
        NOW(), NOW()
      )
      RETURNING id, organization_id, name, status, is_activated, device_uuid, activation_code, created_at
    `;

    return NextResponse.json({
      device: created,
      created: true,
      activated: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Scan-or-create device error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
