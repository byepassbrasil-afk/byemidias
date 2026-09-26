/**
 * /api/dashboard/advertisers
 * Lista anunciantes da org do usuário.
 */

import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';
import { requireAuthApi } from '@/lib/auth';

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

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!user.organization_id) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const pb = await getAdminClient();
    const advertiser = await pb.collection('advertisers').create({
      organization_id: user.organization_id,
      name,
      establishment_name: body.establishment_name || null,
      email: body.email || null,
      phone: body.phone || null,
      document: body.document || null,
      address: body.address || null,
      ticket_value: Number(body.ticket_value || 0),
      status: 'active',
    });
    return NextResponse.json({ advertiser }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao criar anunciante' }, { status: 500 });
  }
}
