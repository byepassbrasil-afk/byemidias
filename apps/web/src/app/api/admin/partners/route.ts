/**
 * /api/admin/partners
 * Lista parceiros da org do usuário (com devices inclusos).
 * Substitui a rota original que usava Postgres com JOIN+json_agg.
 */

import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export async function GET() {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ partners: [] });
    }
    let session: any;
    try { session = JSON.parse(sessionCookie); } catch { return NextResponse.json({ partners: [] }); }
    if (!session?.email) return NextResponse.json({ partners: [] });

    const pb = await getAdminClient();

    // Pega user
    const user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
    let profile = null;
    try { profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`); } catch {}
    if (!profile) return NextResponse.json({ partners: [] });

    const isSuperAdmin = profile.role === 'super_admin';
    const userOrgId = profile.organization_id;

    // Pega partners
    const filter = isSuperAdmin ? '' : `organization_id = "${userOrgId}"`;
    const partners = await pb.collection('partner_access').getFullList({
      filter: filter || undefined,
      sort: '-created',
    });

    // Enriquece com devices
    const allDeviceLinks = await pb.collection('partner_devices').getFullList();
    const deviceIds = [...new Set(allDeviceLinks.map((d: any) => d.device_id))];
    let deviceMap = new Map<string, any>();
    if (deviceIds.length > 0) {
      // Pega devices em batches
      const allDevices = await pb.collection('devices').getFullList();
      deviceMap = new Map(allDevices.map((d: any) => [d.id, d]));
    }
    const deviceLinkMap = new Map<string, any[]>();
    for (const link of allDeviceLinks) {
      const arr = deviceLinkMap.get(link.partner_access_id) || [];
      arr.push({ id: link.id, device_id: link.device_id, playlist_id: link.playlist_id });
      deviceLinkMap.set(link.partner_access_id, arr);
    }

    // Enriquece com categoria
    const catIds = [...new Set(partners.map((p: any) => p.category_id).filter(Boolean))];
    let catMap = new Map();
    if (catIds.length > 0) {
      for (const cid of catIds) {
        try {
          const c = await pb.collection('categories').getOne(cid);
          catMap.set(cid, c);
        } catch {}
      }
    }

    const result = partners.map((p: any) => {
      const c = p.category_id ? catMap.get(p.category_id) : null;
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        name: p.display_name,
        status: p.status,
        created_at: p.created,
        updated_at: p.updated,
        category_id: p.category_id,
        category_name: c?.name,
        category_icon: c?.icon,
        category_color: c?.color,
        category_slug: c?.slug,
        partner_devices: deviceLinkMap.get(p.id) || [],
      };
    });

    return NextResponse.json({ partners: result });
  } catch (e: any) {
    console.error('[partners GET] erro:', e?.message);
    return NextResponse.json({ partners: [], error: e?.message });
  }
}
