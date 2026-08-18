import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { email, password, full_name, role, organization_id } = body;

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, senha e nome são obrigatórios' }, { status: 400 });
  }

  // Check if caller is super_admin
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: { user: caller }, error: callerError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (callerError || !caller) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Check caller role
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super admin pode criar usuários' }, { status: 403 });
  }

  // Create user via admin API
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Create profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    full_name,
    role: role || 'viewer',
    organization_id: organization_id || null,
    status: 'active',
  });

  if (profileError) {
    console.error('Profile error:', profileError);
  }

  return NextResponse.json({ user: newUser.user });
}
