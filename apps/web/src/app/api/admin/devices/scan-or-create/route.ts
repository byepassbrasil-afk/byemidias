import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


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

    const pb = await getAdminClient();

    // 1. Check if device already exists by device_uuid
    let existing: any = null;
    try {
      const filter = `device_uuid = "${device_uuid.replace(/"/g, '\\"')}"`;
      const list = await pb.collection('devices').getList(1, 1, { filter });
      if (list.items.length > 0) {
        existing = list.items[0];
      }
    } catch (e: any) {
      console.error('[scan-or-create] erro ao buscar device:', e.message);
    }

    if (existing) {
      // If not yet activated, activate it now (idempotent)
      const isActivated = existing.status === 'online';
      if (!isActivated) {
        const code = generateActivationCode();
        await pb.collection('devices').update(existing.id, {
          status: 'online',
          model: model || existing.model || '',
        });
      }
      return NextResponse.json({
        device: { ...existing, status: 'online', model: model || existing.model || '' },
        created: false,
        activated: true,
      });
    }

    // 2. Determine which organization the device belongs to
    let orgId = body.organization_id || user.organization_id;
    if (!orgId) {
      // Pega a primeira organização
      const orgs = await pb.collection('organizations').getList(1, 1);
      if (orgs.items.length > 0) orgId = orgs.items[0].id;
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Nenhuma organização disponível' }, { status: 400 });
    }

    // 3. Create the device AND activate it in one step
    const shortId = String(device_uuid).slice(0, 8);
    const deviceData: any = {
      organization_id: orgId,
      name: `Device ${shortId}`,
      model: model || '',
      status: 'online',
      last_heartbeat: new Date().toISOString(),
    };

    const created = await pb.collection('devices').create(deviceData);

    return NextResponse.json({
      device: created,
      created: true,
      activated: true,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[scan-or-create] erro:', msg, e.data);
    return NextResponse.json({ error: msg, data: e.data }, { status: 500 });
  }
}
