import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getPartnerSession } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function GET() {
  // Check admin session first
  const user = await requireAuthApi();
  if (user) {
    const [profile] = await sql`
      SELECT p.id, p.email, p.full_name, p.role, p.status, p.avatar_url, p.phone, p.organization_id, p.created_at,
             o.name as org_name, o.slug as org_slug, o.renewal_date as org_renewal_date, o.plan as org_plan, o.status as org_status
      FROM profiles p
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = ${user.id} LIMIT 1
    `;
    return NextResponse.json({ profile });
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
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { full_name, phone, avatar_url } = body;

  await sql`
    UPDATE profiles SET
      full_name = COALESCE(${full_name}, full_name),
      phone = COALESCE(${phone}, phone),
      avatar_url = COALESCE(${avatar_url}, avatar_url),
      updated_at = NOW()
    WHERE id = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
