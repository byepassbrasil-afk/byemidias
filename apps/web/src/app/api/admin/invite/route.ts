import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { user_id } = body;

  if (!user_id) return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 });

  const isSuperAdmin = user.role === 'super_admin';
  if (!isSuperAdmin) {
    const [target] = await sql`SELECT organization_id FROM profiles WHERE id = ${user_id}`;
    if (!target || target.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Usuário não encontrado ou sem permissão' }, { status: 404 });
    }
  }

  const token = randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await sql`
    UPDATE profiles
    SET invite_token = ${token}, invite_expires_at = ${expires}, invited_at = NOW()
    WHERE id = ${user_id}
  `;

  const inviteUrl = `https://byemidias.vercel.app/invite?token=${token}`;

  return NextResponse.json({ invite_url: inviteUrl, token, expires_at: expires });
}
