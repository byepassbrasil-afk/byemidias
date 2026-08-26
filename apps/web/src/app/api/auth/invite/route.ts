import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });

  const [user] = await sql`
    SELECT p.id, p.full_name, p.invite_expires_at, o.name as org_name
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.invite_token = ${token}
    LIMIT 1
  `;

  if (!user) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 });
  }

  return NextResponse.json({ user_name: user.full_name, org_name: user.org_name });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, password } = body;

  if (!token || !password) return NextResponse.json({ error: 'Token e senha obrigatórios' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });

  const [user] = await sql`
    SELECT id, invite_expires_at FROM profiles WHERE invite_token = ${token} LIMIT 1
  `;
  if (!user) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 });
  }

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(password, 10);

  await sql`
    UPDATE profiles
    SET password_hash = ${hash}, invite_token = NULL, invite_expires_at = NULL, status = 'active', updated_at = NOW()
    WHERE id = ${user.id}
  `;

  return NextResponse.json({ success: true });
}
