import { NextResponse } from 'next/server';
import { createPartnerSession, setPartnerSessionCookie, validatePartnerCredentials } from '@/lib/partner-auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username e senha obrigatórios' }, { status: 400 });
    }

    const result = await validatePartnerCredentials(username, password);

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
