/**
 * /api/dashboard/advertisers
 * Lista anunciantes da org do usuário.
 */

import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return NextResponse.json({ advertisers: [] });
    let session: any;
    try { session = JSON.parse(sessionCookie); } catch { return NextResponse.json({ advertisers: [] }); }
    if (!session?.email) return NextResponse.json({ advertisers: [] });

    const pb = await getAdminClient();
    const user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
    let profile = null;
    try { profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`); } catch {}
    if (!profile) return NextResponse.json({ advertisers: [] });

    const isSuperAdmin = profile.role === 'super_admin';
    const userOrgId = profile.organization_id;

    const filter = isSuperAdmin ? '' : `organization_id = "${userOrgId}"`;
    const items = await pb.collection('advertisers').getFullList({
      filter: filter || undefined,
      sort: '-created',
    });

    return NextResponse.json({ advertisers: items });
  } catch (e: any) {
    console.error('[advertisers GET] erro:', e?.message);
    return NextResponse.json({ advertisers: [], error: e?.message });
  }
}
