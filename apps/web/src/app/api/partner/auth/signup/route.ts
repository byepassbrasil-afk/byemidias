import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, display_name, email, password } = body;

    if (!username || !display_name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Nome de usuário muito curto (mínimo 3)' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM partner_access WHERE username = ${username} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Esse nome de usuário já está em uso' }, { status: 409 });
    }

    const existingEmail = await sql`SELECT id FROM partner_access WHERE email = ${email} LIMIT 1`;
    if (existingEmail.length > 0) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [partner] = await sql`
      INSERT INTO partner_access (username, display_name, email, password_hash, status, created_at)
      VALUES (${username}, ${display_name}, ${email}, ${passwordHash}, 'active', NOW())
      RETURNING id, username, display_name
    `;

    return NextResponse.json({
      success: true,
      message: 'Conta de parceiro criada com sucesso!',
      partner: { id: partner.id, username: partner.username, display_name: partner.display_name },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
