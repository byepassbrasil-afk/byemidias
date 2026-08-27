import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const [profile] = await sql`
      SELECT id, email, full_name FROM profiles WHERE email = ${email} LIMIT 1
    `;

    if (!profile) {
      return NextResponse.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await sql`
      UPDATE profiles
      SET reset_token = ${token}, reset_token_expires_at = ${expiresAt.toISOString()}, updated_at = NOW()
      WHERE id = ${profile.id}
    `;

    const resetUrl = `${request.nextUrl.origin}/reset-password?token=${token}`;

    console.log('=== LINK DE RECUPERAÇÃO ===');
    console.log(`Usuário: ${profile.full_name} (${profile.email})`);
    console.log(`Link: ${resetUrl}`);
    console.log(`Expira: ${expiresAt.toLocaleString('pt-BR')}`);
    console.log('==========================');

    return NextResponse.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      reset_url: resetUrl,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
