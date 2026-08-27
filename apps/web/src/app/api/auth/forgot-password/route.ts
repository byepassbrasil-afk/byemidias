import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import sql from '@/lib/db';
import { sendEmail, forgotPasswordEmail } from '@/lib/email';

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

    // Send email
    const emailTemplate = forgotPasswordEmail(resetUrl, profile.full_name || 'Usuário');
    const emailSent = await sendEmail({
      to: profile.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!emailSent) {
      console.log(`[FORGOT-PASSWORD] Email not sent (no API key). Reset URL: ${resetUrl}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      // Only return reset_url in dev (no email service)
      ...(emailSent ? {} : { reset_url: resetUrl }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
