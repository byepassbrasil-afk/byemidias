import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ByeMidias <noreply@byemidias.com>';

let resend: Resend | null = null;

function getClient() {
  if (!RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log(`[EMAIL STUB] To: ${to}\nSubject: ${subject}\n---\n${text || html.substring(0, 200)}`);
    return false; // No API key configured
  }

  try {
    await client.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    });
    return true;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

// ── Email Templates ──

export function forgotPasswordEmail(resetUrl: string, userName: string): { subject: string; html: string; text: string } {
  return {
    subject: 'ByeMidias — Redefinir sua senha',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
          .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #2563eb; padding: 32px; text-align: center; }
          .header h1 { color: white; font-size: 24px; margin: 0; }
          .body { padding: 32px; }
          .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 16px 0; }
          .footer { padding: 24px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
          .footer p { color: #6b7280; font-size: 12px; margin: 0; }
          .expires { color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ByeMidias</h1>
          </div>
          <div class="body">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="btn">Redefinir Senha</a>
            </p>
            <p class="expires">Este link expira em <strong>1 hora</strong>.</p>
            <p>Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.</p>
          </div>
          <div class="footer">
            <p>ByeMidias — Sistema de Sinais Digitais</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Olá ${userName},\n\nClique no link para redefinir sua senha:\n${resetUrl}\n\nEste link expira em 1 hora.\nSe você não solicitou, ignore este email.`,
  };
}

export function welcomeEmail(userName: string, tempPassword: string, loginUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: 'ByeMidias — Bem-vindo! Acesse sua conta',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
          .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #059669; padding: 32px; text-align: center; }
          .header h1 { color: white; font-size: 24px; margin: 0; }
          .body { padding: 32px; }
          .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 16px 0; }
          .credentials { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .credentials p { margin: 4px 0; font-size: 14px; }
          .footer { padding: 24px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
          .footer p { color: #6b7280; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ByeMidias</h1>
          </div>
          <div class="body">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Sua conta foi criada com sucesso!</p>
            <div class="credentials">
              <p><strong>Login:</strong> ${loginUrl}</p>
              <p><strong>Senha temporária:</strong> ${tempPassword}</p>
            </div>
            <p style="color: #dc2626; font-size: 13px;">⚠️ Altere sua senha após o primeiro login.</p>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="btn">Acessar Painel</a>
            </p>
          </div>
          <div class="footer">
            <p>ByeMidias — Sistema de Sinais Digitais</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Olá ${userName},\n\nSua conta foi criada!\nLogin: ${loginUrl}\nSenha temporária: ${tempPassword}\n\nAltere sua senha após o primeiro login.`,
  };
}
