import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuthApi } from '@/lib/auth';
import { randomUUID } from 'crypto';

const ALLOWED_ROLES_FOR_CREATION: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  admin: ['manager', 'operator', 'viewer'],
  manager: ['operator', 'viewer'],
};

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { email, password, full_name, role } = body;

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, senha e nome são obrigatórios' }, { status: 400 });
  }

  const allowedRoles = ALLOWED_ROLES_FOR_CREATION[user.role] || [];
  const requestedRole = role || 'viewer';

  if (!allowedRoles.includes(requestedRole)) {
    return NextResponse.json({ error: 'Você não pode criar usuários com esta função' }, { status: 403 });
  }

  const userId = randomUUID();
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);

  const orgId = user.role === 'super_admin' ? (body.organization_id || user.organization_id) : user.organization_id;

  const [profile] = await sql`
    INSERT INTO profiles (id, email, full_name, role, organization_id, status, password_hash)
    VALUES (${userId}, ${email}, ${full_name}, ${requestedRole}, ${orgId}, 'active', ${passwordHash})
    RETURNING id, email, full_name, role
  `;

  return NextResponse.json({ user: profile });
}
