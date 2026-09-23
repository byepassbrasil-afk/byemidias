import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';
import { getPartnerSession } from '@/lib/partner-auth';

export const dynamic = 'force-dynamic';


export async function GET() {
  // Check admin session (cookie 'session')
  const cookieStore = await (await import('next/headers')).cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (sessionCookie) {
    let data: any;
    try {
      data = JSON.parse(sessionCookie);
    } catch {
      data = null;
    }
    if (data?.email) {
      try {
        const pb = await getAdminClient();
        const user = await pb.collection('users').getFirstListItem(`email = "${data.email}"`);
        let profile = null;
        try {
          profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
        } catch {}
        let org = null;
        if (profile?.organization_id) {
          try {
            org = await pb.collection('organizations').getOne(profile.organization_id);
          } catch {}
        }
        return NextResponse.json({
          profile: {
            id: user.id,
            email: user.email,
            full_name: profile?.full_name || user.name || user.email,
            role: profile?.role || 'manager',
            status: profile?.status || 'active',
            avatar_url: user.avatar || null,
            organization_id: profile?.organization_id || null,
            org_name: org?.name,
            org_slug: org?.slug,
            org_renewal_date: org?.renewal_date,
            org_plan: org?.plan,
            org_status: org?.status,
            created_at: user.created,
          },
        });
      } catch (e) {
        console.error('[profile] erro ao buscar user no PB:', e);
      }
    }
  }

  // Check partner session
  const partner = await getPartnerSession();
  if (partner) {
    return NextResponse.json({
      partner: {
        username: partner.username,
        displayName: partner.displayName,
        organizationId: partner.organizationId,
        slug: partner.slug,
      },
    });
  }

  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
}

export async function PUT(request: Request) {
  const cookieStore = await (await import('next/headers')).cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  let data: any;
  try {
    data = JSON.parse(sessionCookie);
  } catch {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }
  if (!data?.email) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  try {
    const pb = await getAdminClient();
    const user = await pb.collection('users').getFirstListItem(`email = "${data.email}"`);
    const body = await request.json();
    const { full_name, phone, avatar_url } = body;
    await pb.collection('users').update(user.id, {
      name: full_name,
      avatar: avatar_url,
    });
    // Atualiza phone na collection profiles (custom)
    try {
      const profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
      if (profile) {
        await pb.collection('profiles').update(profile.id, { phone, full_name });
      }
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
