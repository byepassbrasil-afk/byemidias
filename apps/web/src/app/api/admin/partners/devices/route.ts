import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const body = await request.json();
    const partnerId = body.partner_id;
    const devices = Array.isArray(body.devices) ? body.devices : [];
    if (!partnerId) return NextResponse.json({ error: 'partner_id obrigatório' }, { status: 400 });
    const pb = await getAdminClient();
    const partner = await pb.collection('partner_access').getOne(partnerId);
    if (user.role !== 'super_admin' && partner.organization_id !== user.organization_id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const existing = await pb.collection('partner_devices').getFullList({ filter: `partner_access_id = "${partnerId}"` });
    for (const link of existing.items) await pb.collection('partner_devices').delete(link.id);
    for (const item of devices) {
      if (!item?.device_id) continue;
      const device = await pb.collection('devices').getOne(item.device_id).catch(() => null);
      if (!device || (user.role !== 'super_admin' && device.organization_id !== user.organization_id)) continue;
      await pb.collection('partner_devices').create({
        partner_access_id: partnerId,
        organization_id: partner.organization_id,
        device_id: item.device_id,
        playlist_id: item.playlist_id || null,
      });
      if (item.playlist_id) {
        const slots = await pb.collection('playlist_slots').getList(1, 1, {
          filter: `partner_access_id = "${partnerId}" && playlist_id = "${item.playlist_id}"`,
        });
        if ((slots.items || []).length === 0) {
          await pb.collection('playlist_slots').create({
            partner_access_id: partnerId,
            organization_id: partner.organization_id,
            playlist_id: item.playlist_id,
            slot_index: (slots.items?.length || 0) + 1,
            slot_order: (slots.items?.length || 0) + 1,
            duration: 0,
          });
        }
      }
    }
    return NextResponse.json({ success: true, count: devices.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao vincular dispositivos' }, { status: 500 });
  }
}
