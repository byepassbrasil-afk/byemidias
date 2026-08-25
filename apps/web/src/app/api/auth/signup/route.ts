import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, senha e nome são obrigatórios' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM profiles WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    const [profile] = await sql`
      INSERT INTO profiles (id, email, full_name, role, status, password_hash)
      VALUES (${userId}, ${email}, ${full_name}, 'viewer', 'active', ${passwordHash})
      RETURNING id, email, full_name, role
    `;

    const response = NextResponse.json({ user: profile });

    response.cookies.set('session', JSON.stringify({ email: profile.email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
