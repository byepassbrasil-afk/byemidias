import { NextResponse } from 'next/server';
import { createPartnerSession, setPartnerSessionCookie, validatePartnerCredentials } from '@/lib/partner-auth';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username e senha obrigatórios' }, { status: 400 });
    }

    const result = await validatePartnerCredentials(username, password, slug);

    if (!result.valid || !result.partner) {
      return NextResponse.json({ error: 'Credenciais inválidas ou organização não encontrada' }, { status: 401 });
    }

    const token = await createPartnerSession(result.partner);
    await setPartnerSessionCookie(token);

    return NextResponse.json({ success: true, partner: result.partner });
  } catch (error) {
    console.error('Partner login error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
