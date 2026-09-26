/**
 * /api/admin/partners
 * Lista e cria parceiros.
 */

import { NextResponse, NextRequest } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ partners: [] });

    const pb = await getAdminClient();
    const isSuperAdmin = user.role === 'super_admin';
    const userOrgId = user.organization_id;

    let partners: any[];
    if (isSuperAdmin) {
      partners = await pb.collection('partner_access').getFullList({
        sort: '-id',
      });
    } else {
      partners = await pb.collection('partner_access').getFullList({
        filter: `organization_id = "${userOrgId}"`,
        sort: '-id',
      });
    }

    const allDeviceLinks = await pb.collection('partner_devices').getFullList();
    const deviceLinkMap = new Map<string, any[]>();
    for (const link of allDeviceLinks) {
      const partnerKey = link.partner_access_id || link.partner_id;
      const arr = deviceLinkMap.get(partnerKey) || [];
      arr.push({ id: link.id, device_id: link.device_id, playlist_id: link.playlist_id || null });
      deviceLinkMap.set(partnerKey, arr);
    }

    const result = partners.map((p: any) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      name: p.display_name,
      status: p.status,
      created_at: p.created,
      updated_at: p.updated,
      organization_id: p.organization_id,
      role: p.role,
      partner_devices: deviceLinkMap.get(p.id) || [],
    }));

    return NextResponse.json({ partners: result });
  } catch (e: any) {
    console.error('[partners GET] erro:', e?.message);
    return NextResponse.json({ partners: [], error: e?.message });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { username, display_name, email, status = 'active', role = 'viewer', category_id = '', device_ids = [] } = body;

    if (!username || !display_name) {
      return NextResponse.json({ error: 'username e display_name são obrigatórios' }, { status: 400 });
    }

    const orgId = user.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 });
    }

    const pb = await getAdminClient();
    const partnerCollection = await pb.collections.getOne('partner_access');
    const existingPartnerFields = partnerCollection.fields || partnerCollection.schema || [];
    const missingPartnerFields = [
      { name: 'password_hash', type: 'text' },
      { name: 'status', type: 'text' },
    ].filter((f) => !existingPartnerFields.some((s: any) => s.name === f.name));
    if (missingPartnerFields.length > 0) {
      await pb.collections.update('partner_access', { fields: [...existingPartnerFields, ...missingPartnerFields] });
    }

    // Cria partner_access
    const password = body.password;
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }
    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.hash(String(password), 10);

    const partnerData: any = {
      username: String(username).toLowerCase().trim(),
      display_name,
      email: email || '',
      status,
      role,
      organization_id: orgId,
      category_id: category_id || null,
      password_hash,
    };

    const partner = await pb.collection('partner_access').create(partnerData);

    // Vincula devices se fornecidos
    if (device_ids && Array.isArray(device_ids) && device_ids.length > 0) {
      for (const deviceId of device_ids) {
          await pb.collection('partner_devices').create({
          partner_access_id: partner.id,
          device_id: deviceId,
        });
      }
    }

    return NextResponse.json({ success: true, partner });
  } catch (e: any) {
    console.error('[partners POST] erro:', e?.message, e.data);
    return NextResponse.json({ error: e?.message, data: e?.data }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const pb = await getAdminClient();

    if (user.role !== 'super_admin' && updates.organization_id !== user.organization_id) {
      const existing = await pb.collection('partner_access').getOne(id);
      if (existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    if (updates.password) {
      const bcrypt = await import('bcryptjs');
      updates.password_hash = await bcrypt.hash(String(updates.password), 10);
      delete updates.password;
    }
    const updated = await pb.collection('partner_access').update(id, updates);
    return NextResponse.json({ success: true, partner: updated });
  } catch (e: any) {
    console.error('[partners PUT] erro:', e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const pb = await getAdminClient();

    if (user.role !== 'super_admin') {
      const existing = await pb.collection('partner_access').getOne(id);
      if (existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    // Remove partner_devices vinculados
    const deviceLinks = await pb.collection('partner_devices').getList(1, 500, {
      filter: `partner_id = "${id}"`,
    });
    for (const link of deviceLinks.items) {
      await pb.collection('partner_devices').delete(link.id);
    }

    await pb.collection('partner_access').delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[partners DELETE] erro:', e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
