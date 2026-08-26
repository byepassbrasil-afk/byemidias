import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const user = await requireAuthApi();
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const pending = await sql`
    SELECT p.id, p.email, p.full_name, p.status, p.created_at,
           o.id as org_id, o.name as org_name, o.slug as org_slug, o.created_at as org_created_at
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.status = 'pending_invite'
    ORDER BY p.created_at DESC
  `;

  return NextResponse.json({ data: pending ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, action } = body;

  if (!user_id || !action) {
    return NextResponse.json({ error: 'user_id e action obrigatórios' }, { status: 400 });
  }

  if (action === 'approve') {
    await sql`UPDATE profiles SET status = 'active', updated_at = NOW() WHERE id = ${user_id}`;
    const [profile] = await sql`SELECT organization_id FROM profiles WHERE id = ${user_id} LIMIT 1`;
    if (profile?.organization_id) {
      await sql`UPDATE organizations SET status = 'active', updated_at = NOW() WHERE id = ${profile.organization_id}`;
    }
    return NextResponse.json({ success: true, message: 'Conta aprovada com sucesso' });
  }

  if (action === 'reject') {
    const [profile] = await sql`SELECT organization_id FROM profiles WHERE id = ${user_id} LIMIT 1`;
    if (profile?.organization_id) {
      await sql`DELETE FROM organizations WHERE id = ${profile.organization_id}`;
    }
    await sql`DELETE FROM profiles WHERE id = ${user_id}`;
    return NextResponse.json({ success: true, message: 'Cadastro rejeitado e removido' });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
