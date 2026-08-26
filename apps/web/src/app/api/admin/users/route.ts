import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuthApi } from '@/lib/auth';
import { randomUUID } from 'crypto';

const CAN_CREATE: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  admin: ['admin', 'manager', 'operator', 'viewer'],
  manager: ['manager', 'operator', 'viewer'],
};

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { email, full_name, role } = body;

  if (!email || !full_name) return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 });

  const requestedRole = role || 'viewer';
  const allowed = CAN_CREATE[user.role] || [];

  if (!allowed.includes(requestedRole)) {
    return NextResponse.json({ error: `Você não pode criar usuários com função "${requestedRole}"` }, { status: 403 });
  }

  const userId = randomUUID();
  const inviteToken = randomUUID();
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const orgId = user.role === 'super_admin' ? (body.organization_id || user.organization_id) : user.organization_id;

  const [profile] = await sql`
    INSERT INTO profiles (id, email, full_name, role, organization_id, status, invite_token, invite_expires_at, invited_at)
    VALUES (${userId}, ${email}, ${full_name}, ${requestedRole}, ${orgId}, 'pending_invite', ${inviteToken}, ${inviteExpires}, NOW())
    RETURNING id, email, full_name, role, organization_id
  `;

  const inviteUrl = `https://byemidias.vercel.app/invite?token=${inviteToken}`;

  return NextResponse.json({
    user: profile,
    invite_url: inviteUrl,
    message: 'Usuário criado. Envie o link de convite para definir a senha.',
  });
}
