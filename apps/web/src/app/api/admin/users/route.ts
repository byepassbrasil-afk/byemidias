import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuthApi } from '@/lib/auth';
import { randomUUID, randomBytes } from 'crypto';

// Hierarquia estrita (do mais alto pro mais baixo)
const ROLE_HIERARCHY = ['super_admin', 'admin', 'manager', 'operator', 'viewer'] as const;
type Role = (typeof ROLE_HIERARCHY)[number];

const ROLE_LEVEL: Record<Role, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_HIERARCHY as readonly string[]).includes(value);
}

/**
 * Quem pode ser criado/editado por cada role.
 * - super_admin: ninguém pode ser criado (apenas o próprio, já existe)
 * - admin: admin, manager, operator, viewer (não pode criar super_admin, não pode criar outro admin de nível igual? pode sim — admin pode criar admin)
 * - manager: manager, operator, viewer
 * - operator: operator, viewer
 * - viewer: ninguém
 *
 * Regra: a hierarquia é estrita. Você só pode criar/editar users com role
 * IGUAL OU INFERIOR à sua. E super_admin nunca pode ser criado por ninguém.
 */
function canManage(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'super_admin') return false; // ninguém pode criar/editar super_admin
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole];
}

function canView(actorRole: string, targetRole: string): boolean {
  // Você só vê roles do mesmo nível ou abaixo
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  if (actorRole === 'super_admin') return true;
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole];
}

function listManageableRoles(actorRole: string): Role[] {
  return ROLE_HIERARCHY.filter(r => r !== 'super_admin' && canManage(actorRole, r));
}

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
               p.organization_id, o.name as org_name, o.slug as org_slug
        FROM profiles p
        LEFT JOIN organizations o ON p.organization_id = o.id
        ORDER BY p.created_at DESC
      `;
    } else {
      // Filtra também por hierarquia: usuário só vê roles do seu nível ou abaixo
      const maxLevel = ROLE_LEVEL[user.role as Role] ?? 0;
      const visibleRoles = ROLE_HIERARCHY.filter(r => ROLE_LEVEL[r] <= maxLevel);
      users = await sql`
        SELECT p.id, p.email, p.full_name, p.role, p.status, p.avatar_url, p.phone, p.created_at,
               p.organization_id, o.name as org_name, o.slug as org_slug
        FROM profiles p
        LEFT JOIN organizations o ON p.organization_id = o.id
        WHERE p.organization_id = ${user.organization_id}
          AND p.role = ANY(${visibleRoles as unknown as string[]})
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

  if (!user.organization_id && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sua conta não está vinculada a uma organização. Contate o suporte.' }, { status: 400 });
  }

  const body = await request.json();
  const { email, full_name, role, organization_id, send_invite } = body;

  if (!email || !full_name) {
    return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 });
  }

  if (!role || !isRole(role)) {
    return NextResponse.json({ error: 'Função inválida' }, { status: 400 });
  }

  // REGRA 1: ninguém pode criar super_admin
  if (role === 'super_admin') {
    return NextResponse.json({ error: 'Não é permitido criar usuários com função "super_admin"' }, { status: 403 });
  }

  // REGRA 2: hierarquia estrita — só pode criar role igual ou inferior
  if (!canManage(user.role, role)) {
    return NextResponse.json(
      { error: `Você não tem permissão para criar usuários com função "${role}". Sua função "${user.role}" só pode criar: ${listManageableRoles(user.role).join(', ') || 'ninguém'}.` },
      { status: 403 }
    );
  }

  const existing = await sql`SELECT id FROM profiles WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Já existe um usuário com esse email' }, { status: 409 });
  }

  // Resolve organization_id
  let orgId: string | null = null;
  const isSuperAdmin = user.role === 'super_admin';

  if (isSuperAdmin) {
    orgId = body.organization_id || user.organization_id;
  } else {
    if (organization_id && organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Você só pode criar usuários na sua própria organização' }, { status: 403 });
    }
    orgId = user.organization_id;
  }

  if (!orgId) {
    return NextResponse.json({ error: 'Organização obrigatória. super_admin deve informar organization_id no body.' }, { status: 400 });
  }

  const [org] = await sql`SELECT id, name, status FROM organizations WHERE id = ${orgId} LIMIT 1`;
  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
  }
  if (org.status === 'inactive' || org.status === 'suspended') {
    return NextResponse.json({ error: `Não é possível criar usuário em organização com status "${org.status}"` }, { status: 400 });
  }

  const userId = randomUUID();
  const shouldSendInvite = send_invite !== false;
  let passwordHash: string;
  let inviteToken: string | null = null;
  let inviteExpiresAt: string | null = null;
  let tempPassword: string | null = null;

  const bcrypt = await import('bcryptjs');

  if (shouldSendInvite) {
    inviteToken = randomUUID();
    inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    passwordHash = 'temp:' + await bcrypt.hash(randomBytes(8).toString('hex'), 10);
  } else {
    tempPassword = generateTempPassword();
    passwordHash = 'temp:' + await bcrypt.hash(tempPassword, 10);
  }

  const [profile] = await sql`
    INSERT INTO profiles (
      id, email, full_name, role, organization_id, status, password_hash,
      invite_token, invite_expires_at, invited_by
    )
    VALUES (
      ${userId}, ${email}, ${full_name}, ${role}, ${orgId},
      ${shouldSendInvite ? 'pending_invite' : 'active'},
      ${passwordHash},
      ${inviteToken}, ${inviteExpiresAt}, ${user.id}
    )
    RETURNING id, email, full_name, role, organization_id, status
  `;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://byemidias.vercel.app';
  const inviteUrl = inviteToken ? `${baseUrl}/invite?token=${inviteToken}` : null;

  return NextResponse.json({
    user: profile,
    organization: { id: org.id, name: org.name },
    invite_url: inviteUrl,
    temp_password: tempPassword,
    message: shouldSendInvite
      ? 'Usuário criado. Convite gerado (expira em 7 dias).'
      : 'Usuário criado. Senha temporária gerada.',
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { user_id, role } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 });
  }
  if (!role || !isRole(role)) {
    return NextResponse.json({ error: 'Função inválida' }, { status: 400 });
  }

  // Busca o target
  const [target] = await sql`SELECT id, role, organization_id FROM profiles WHERE id = ${user_id} LIMIT 1`;
  if (!target) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  // Não-admin não pode editar user de outra org
  if (user.role !== 'super_admin' && target.organization_id !== user.organization_id) {
    return NextResponse.json({ error: 'Você não tem permissão para editar usuários de outras organizações' }, { status: 403 });
  }

  // Não pode editar a si mesmo (evita rebaixar quem tá mandando)
  if (target.id === user.id) {
    return NextResponse.json({ error: 'Você não pode alterar o seu próprio role. Peça a outro admin.' }, { status: 403 });
  }

  // REGRA 1: ninguém pode promover para super_admin
  if (role === 'super_admin') {
    return NextResponse.json({ error: 'Não é permitido promover usuários para "super_admin"' }, { status: 403 });
  }

  // REGRA 2: hierarquia estrita
  // Você só pode editar target com role IGUAL ou INFERIOR à sua
  if (!canManage(user.role, target.role)) {
    return NextResponse.json(
      { error: `Você não pode editar usuários com função "${target.role}" (igual ou superior à sua).` },
      { status: 403 }
    );
  }

  // E só pode definir um role que você também pode criar
  if (!canManage(user.role, role)) {
    return NextResponse.json(
      { error: `Sua função "${user.role}" não pode definir a função "${role}". Permitidas: ${listManageableRoles(user.role).join(', ') || 'nenhuma'}.` },
      { status: 403 }
    );
  }

  await sql`UPDATE profiles SET role = ${role}, updated_at = NOW() WHERE id = ${user_id}`;

  return NextResponse.json({ success: true, message: 'Função atualizada' });
}
