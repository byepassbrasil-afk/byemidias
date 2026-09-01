import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// POST /api/lp/lead — Save contact form submission from landing page
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, source, organization_slug } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name e email obrigatórios' }, { status: 400 });
    }

    // If slug provided, try to find org_id
    let orgId: string | null = null;
    if (organization_slug) {
      const [org] = await sql`SELECT id FROM organizations WHERE slug = ${organization_slug} LIMIT 1`;
      orgId = org?.id || null;
    }

    const [created] = await sql`
      INSERT INTO contact_leads (organization_id, name, email, phone, message, source)
      VALUES (${orgId}, ${name}, ${email}, ${phone || null}, ${message || null}, ${source || 'generic'})
      RETURNING id
    `;

    return NextResponse.json({ success: true, lead_id: created.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
