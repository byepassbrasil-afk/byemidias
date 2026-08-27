import { NextResponse } from 'next/server';
import { createPartnerSession, setPartnerSessionCookie, validatePartnerCredentials } from '@/lib/partner-auth';

// Legacy route — redirects to slug-based login
export async function POST(request: Request) {
  try {
    const { username, password, slug } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username e senha obrigatórios' }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Slug da organização obrigatório. Use /api/partner/[slug]/auth/login' }, { status: 400 });
    }

    const result = await validatePartnerCredentials(username, password, slug);

    if (!result.valid || !result.partner) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const token = await createPartnerSession(result.partner);
    await setPartnerSessionCookie(token);

    return NextResponse.json({ success: true, partner: result.partner });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
