import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token, new_password } = await request.json();

    if (!token || !new_password) {
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const [profile] = await sql`
      SELECT id, reset_token_expires_at
      FROM profiles
      WHERE reset_token = ${token}
      LIMIT 1
    `;

    if (!profile) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    if (new Date(profile.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado. Solicite um novo.' }, { status: 400 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(new_password, 10);

    await sql`
      UPDATE profiles
      SET password_hash = ${passwordHash},
          reset_token = NULL,
          reset_token_expires_at = NULL,
          updated_at = NOW()
      WHERE id = ${profile.id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com a nova senha.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
