import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuthApi } from '@/lib/auth';
import { randomUUID, randomBytes } from 'crypto';

const CAN_CREATE: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  admin: ['admin', 'manager', 'operator', 'viewer'],
  manager: ['manager', 'operator', 'viewer'],
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const buf = randomBytes(10);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[buf[i] % chars.length];
  }
  return result;
}

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const isSuperAdmin = user.role === 'super_admin';
    let users;

    if (isSuperAdmin) {
      users = await sql`
        SELECT p.id, p.email, p.full_name, p.role, p.status, p.avatar_url, p.phone, p.created_at,
               p.organization_id, o.name as org_name
        FROM profiles p
        LEFT JOIN organizations o ON p.organization_id = o.id
        ORDER BY p.created_at DESC
      `;
    } else {
      users = await sql`
        SELECT p.id, p.email, p.full_name, p.role, p.status, p.avatar_url, p.phone, p.created_at,
               p.organization_id, o.name as org_name
        FROM profiles p
        LEFT JOIN organizations o ON p.organization_id = o.id
        WHERE p.organization_id = ${user.organization_id}
        ORDER BY p.created_at DESC
      `;
    }

    return NextResponse.json({ users: users || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

  const bcrypt = await import('bcryptjs');
  const tempPassword = generateTempPassword();
  const passwordHash = 'temp:' + await bcrypt.hash(tempPassword, 10);

  const userId = randomUUID();
  const orgId = user.role === 'super_admin' ? (body.organization_id || user.organization_id) : user.organization_id;

  const [profile] = await sql`
    INSERT INTO profiles (id, email, full_name, role, organization_id, status, password_hash)
    VALUES (${userId}, ${email}, ${full_name}, ${requestedRole}, ${orgId}, 'active', ${passwordHash})
    RETURNING id, email, full_name, role, organization_id
  `;

  return NextResponse.json({
    user: profile,
    temp_password: tempPassword,
    message: 'Usuário criado. Senha temporária gerada.',
  });
}
