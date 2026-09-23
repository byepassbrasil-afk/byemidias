/**
 * /api/pb/categories
 * Lista categorias disponíveis (global + da org do usuário).
 * Substitui /api/dashboard/categories e /api/admin/categories/global.
 */

import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ categories: [] });
    }
    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ categories: [] });
    }
    if (!session?.email) {
      return NextResponse.json({ categories: [] });
    }

    const pb = await getAdminClient();
    const user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
    let profile = null;
    try {
      profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    } catch {}
    const isSuperAdmin = profile?.role === 'super_admin';
    const userOrgId = profile?.organization_id;

    // Pega global (organization_id vazio) OU da org
    let filter = 'organization_id = ""';
    if (!isSuperAdmin && userOrgId) {
      filter = `organization_id = "" || organization_id = "${userOrgId}"`;
    } else if (isSuperAdmin) {
      filter = ''; // sem filtro, vê tudo
    }

    const result = await pb.collection('categories').getList(1, 500, { filter });

    return NextResponse.json({
      categories: result.items.map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        description: c.description,
        is_default: c.is_default,
        is_global: !c.organization_id,
        slug: c.slug,
      })),
    });
  } catch (e: any) {
    console.error('[categories GET] erro:', e);
    return NextResponse.json({ categories: [] });
  }
}
