import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomBytes } from 'crypto';
import sql from '@/lib/db';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const buf = randomBytes(10);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[buf[i] % chars.length];
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, company_name, company_slug } = body;

    if (!email || !full_name || !company_name || !company_slug) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const slug = company_slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slug.length < 3) {
      return NextResponse.json({ error: 'Slug muito curto (mínimo 3 caracteres)' }, { status: 400 });
    }

    const existingUser = await sql`SELECT id FROM profiles WHERE email = ${email} LIMIT 1`;
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
    }

    const existingSlug = await sql`SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1`;
    if (existingSlug.length > 0) {
      return NextResponse.json({ error: 'Esse slug já está em uso. Tente outro.' }, { status: 409 });
    }

    const bcrypt = await import('bcryptjs');
    const tempPassword = generateTempPassword();
    const passwordHash = 'temp:' + await bcrypt.hash(tempPassword, 10);

    const orgId = randomUUID();
    const userId = randomUUID();

    const [org] = await sql`
      INSERT INTO organizations (id, name, slug, status, plan, max_devices, created_at)
      VALUES (${orgId}, ${company_name}, ${slug}, 'pending_approval', 'free', 3, NOW())
      RETURNING id, name, slug
    `;

    const [profile] = await sql`
      INSERT INTO profiles (id, email, full_name, role, organization_id, status, password_hash, created_at)
      VALUES (${userId}, ${email}, ${full_name}, 'manager', ${orgId}, 'active', ${passwordHash}, NOW())
      RETURNING id, email, full_name, role
    `;

    await sql`
      UPDATE organizations SET owner_id = ${userId} WHERE id = ${orgId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso!',
      user: { id: profile.id, email: profile.email, full_name: profile.full_name },
      organization: { id: org.id, name: org.name, slug: org.slug },
      temp_password: tempPassword,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
