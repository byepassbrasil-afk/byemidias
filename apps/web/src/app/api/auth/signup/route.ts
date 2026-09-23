import { NextRequest, NextResponse } from 'next/server';
import { generateSlug } from '@/lib/pb-server';
import { getAdminClient, newId, findOne, create, update, hashPassword } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, company_name, company_slug } = body;

    if (!email || !password || !full_name || !company_name || !company_slug) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 });
    }

    const slug = generateSlug(company_slug);
    if (slug.length < 3) {
      return NextResponse.json({ error: 'Slug muito curto (mínimo 3 caracteres)' }, { status: 400 });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const pb = await getAdminClient();

    // 1. Verifica se email já existe na collection users (auth)
    let existingUser = null;
    try {
      existingUser = await pb.collection('users').getFirstListItem(`email = "${emailNorm}"`);
      if (existingUser) {
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
      }
    } catch (e: any) {
      if (e.status !== 404 && e.status !== 400) {
        console.error('[signup] check email error:', e.message);
        throw e;
      }
      // 404 = not found (good), 400 = pode ser erro de filter, continuar
    }

    // 2. Verifica slug único em organizations
    let existingSlug = null;
    try {
      existingSlug = await pb.collection('organizations').getFirstListItem(`slug = "${slug}"`);
      if (existingSlug) {
        return NextResponse.json({ error: 'Esse slug já está em uso. Tente outro.' }, { status: 409 });
      }
    } catch (e: any) {
      if (e.status !== 404 && e.status !== 400) {
        console.error('[signup] check slug error:', e.message);
        throw e;
      }
      // 404 = not found (good), 400 = pode ser erro de filter, continuar
    }

    // 3. Cria a organização
    const orgId = newId();
    const org = await pb.collection('organizations').create({
      id: orgId,
      name: company_name,
      slug,
      status: 'pending_approval',
      plan: 'free',
      max_devices: 3,
    });

    // 4. Cria o usuário na collection users (auth) — PocketBase cuida do hash
    const user = await pb.collection('users').create({
      email: email.toLowerCase().trim(),
      password,
      passwordConfirm: password,
      emailVisibility: true,
      verified: true,  // verificado direto (sem email confirmation)
    });

    // 5. Cria o profile vinculado ao user
    const profile = await pb.collection('profiles').create({
      id: newId(),
      user_id: user.id,
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role: 'manager',
      status: 'active',
      organization_id: orgId,
    });

    // 6. Define o owner_id da organization
    await pb.collection('organizations').update(orgId, { owner_id: user.id });

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso!',
      user: {
        id: user.id,
        email: user.email,
        full_name: profile.full_name,
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    const stack = e instanceof Error ? e.stack : '';
    console.error('[signup] ERRO:', msg);
    console.error('[signup] STACK:', stack?.slice(0, 800));
    if (e && typeof e === 'object' && 'data' in e) {
      console.error('[signup] data:', JSON.stringify(e.data).slice(0, 500));
    }
    // Extrair mensagem útil do PocketBase
    let userMessage = msg;
    if (e?.data?.data) {
      const fields = e.data.data;
      const fieldErrors = Object.entries(fields).map(([key, val]: [string, any]) => {
        const fieldMsg = val?.message || val?.code || JSON.stringify(val);
        return `${key}: ${fieldMsg}`;
      });
      if (fieldErrors.length > 0) {
        userMessage = fieldErrors.join('; ');
      }
    } else if (e?.data?.message) {
      userMessage = e.data.message;
    }
    // Se for erro do PocketBase com status válido, usa ele
    const errStatus = (e?.status && e.status >= 400 && e.status < 600) ? e.status : 500;
    return NextResponse.json({
      error: userMessage,
      status: e?.status,
      data: e?.data,
    }, { status: errStatus });
  }
}

