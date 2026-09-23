import { NextRequest, NextResponse } from 'next/server';
import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export const dynamic = 'force-dynamic';

async function authPB(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection('_superusers').authWithPassword(
      process.env.PB_ADMIN_EMAIL || '',
      process.env.PB_ADMIN_PASSWORD || ''
    );
  } catch (e: any) {
    if (e.status === 404) {
      await pb.admins.authWithPassword(
        process.env.PB_ADMIN_EMAIL || '',
        process.env.PB_ADMIN_PASSWORD || ''
      );
    } else {
      throw e;
    }
  }
  return pb;
}

export async function POST(request: NextRequest) {
  const steps: any[] = [];

  try {
    const body = await request.json();
    const { email, password, full_name, company_name, company_slug } = body;

    steps.push({ step: 'parsed', email, hasPassword: !!password, full_name, company_name, company_slug });

    if (!email || !password || !full_name || !company_name || !company_slug) {
      return NextResponse.json({ error: 'Campos faltando', steps }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha muito curta', steps }, { status: 400 });
    }

    const pb = await authPB();
    steps.push({ step: 'auth_ok' });

    const emailNorm = email.toLowerCase().trim();

    // Verifica se email existe
    try {
      const existing = await pb.collection('users').getFirstListItem(`email = "${emailNorm}"`);
      steps.push({ step: 'existing_user_found', existing });
      return NextResponse.json({ error: 'Email já cadastrado', steps }, { status: 409 });
    } catch (e: any) {
      steps.push({ step: 'existing_user_check', status: e.status, error: e.message });
    }

    // Verifica slug
    try {
      const existingSlug = await pb.collection('organizations').getFirstListItem(`slug = "${company_slug}"`);
      steps.push({ step: 'existing_slug_found', existing: existingSlug });
      return NextResponse.json({ error: 'Slug em uso', steps }, { status: 409 });
    } catch (e: any) {
      steps.push({ step: 'existing_slug_check', status: e.status, error: e.message });
    }

    // Cria org
    let org;
    try {
      org = await pb.collection('organizations').create({
        name: company_name,
        slug: company_slug,
        status: 'pending_approval',
        plan: 'free',
        max_devices: 3,
      });
      steps.push({ step: 'org_created', id: org.id });
    } catch (e: any) {
      steps.push({ step: 'org_failed', status: e.status, error: e.message, data: e.data });
      return NextResponse.json({ error: 'Falha ao criar org', steps, status: e.status, data: e.data }, { status: 500 });
    }

    // Cria user
    let user;
    try {
      user = await pb.collection('users').create({
        email: emailNorm,
        password,
        passwordConfirm: password,
        emailVisibility: true,
        verified: true,
      });
      steps.push({ step: 'user_created', id: user.id });
    } catch (e: any) {
      steps.push({ step: 'user_failed', status: e.status, error: e.message, data: e.data });
      return NextResponse.json({ error: 'Falha ao criar user', steps, status: e.status, data: e.data }, { status: 500 });
    }

    // Cria profile
    let profile;
    try {
      profile = await pb.collection('profiles').create({
        user_id: user.id,
        email: emailNorm,
        full_name,
        role: 'manager',
        status: 'active',
        organization_id: org.id,
      });
      steps.push({ step: 'profile_created', id: profile.id });
    } catch (e: any) {
      steps.push({ step: 'profile_failed', status: e.status, error: e.message, data: e.data });
      return NextResponse.json({ error: 'Falha ao criar profile', steps, status: e.status, data: e.data }, { status: 500 });
    }

    // Update org owner
    try {
      await pb.collection('organizations').update(org.id, { owner_id: user.id });
      steps.push({ step: 'org_owner_updated' });
    } catch (e: any) {
      steps.push({ step: 'org_owner_failed', error: e.message });
    }

    return NextResponse.json({
      success: true,
      message: 'Conta criada!',
      user: { id: user.id, email: user.email },
      organization: { id: org.id, name: org.name, slug: org.slug },
      profile: { id: profile.id },
      steps,
    });
  } catch (e: any) {
    return NextResponse.json({
      error: 'Outer error: ' + e.message,
      stack: e.stack?.slice(0, 500),
      steps,
    }, { status: 500 });
  }
}
