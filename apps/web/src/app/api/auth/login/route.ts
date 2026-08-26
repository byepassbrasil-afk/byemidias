import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const [profile] = await sql`SELECT id, email, full_name, role, status, password_hash, organization_id FROM profiles WHERE email = ${email} LIMIT 1`;

    if (!profile) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (profile.status === 'pending_invite') {
      return NextResponse.json({ error: 'Sua conta está aguardando aprovação do administrador.' }, { status: 403 });
    }
    if (profile.status !== 'active') {
      return NextResponse.json({ error: 'Conta inativa. Contate o administrador.' }, { status: 403 });
    }

    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const mustChangePassword = profile.password_hash.startsWith('temp:');

    const response = NextResponse.json({
      user: { id: profile.id, email: profile.email, full_name: profile.full_name, role: profile.role },
      must_change_password: mustChangePassword,
    });

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
