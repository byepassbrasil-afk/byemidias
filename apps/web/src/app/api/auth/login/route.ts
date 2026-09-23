import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyPassword } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const pb = await getAdminClient();

    // Busca o user no PocketBase (collection users, tipo auth)
    let user;
    try {
      user = await pb.collection('users').getFirstListItem(`email = "${emailNorm}"`);
    } catch (e: any) {
      if (e?.status === 404) {
        return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
      }
      throw e;
    }

    // (verified check removido — signup cria verificado, e auth do PB já garante email válido)

    // PB não tem bcrypt.compare via admin; mas podemos tentar login via auth
    // para confirmar a senha. Se falhar, a senha está errada.
    let passwordOk = false;
    try {
      const authPb = new (require('pocketbase/cjs'))(process.env.PB_URL);
      await authPb.collection('users').authWithPassword(emailNorm, password);
      passwordOk = true;
    } catch {
      passwordOk = false;
    }

    if (!passwordOk) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Pega profile vinculado (collection custom)
    let profile = null;
    try {
      profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    } catch {
      // Sem profile — não bloqueia, mas status não tem
    }

    // Status check (mirror do Neon)
    if (profile?.status === 'pending_invite') {
      return NextResponse.json({ error: 'Sua conta está aguardando aprovação do administrador.' }, { status: 403 });
    }
    if (profile?.status && profile.status !== 'active') {
      return NextResponse.json({ error: 'Conta inativa. Contate o administrador.' }, { status: 403 });
    }

    const mustChangePassword = false; // PB não usa temp: prefix

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.name || user.email,
        role: profile?.role || 'manager',
        organization_id: profile?.organization_id,
      },
      must_change_password: mustChangePassword,
    });

    response.cookies.set('session', JSON.stringify({ email: user.email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    const stack = e instanceof Error ? e.stack : '';
    console.error('[login] ERRO:', msg);
    console.error('[login] STACK:', stack?.slice(0, 800));
    if (e?.data) console.error('[login] data:', JSON.stringify(e.data).slice(0, 500));
    if (e?.status) console.error('[login] status:', e.status);
    return NextResponse.json({ error: msg, status: e?.status }, { status: 500 });
  }
}
