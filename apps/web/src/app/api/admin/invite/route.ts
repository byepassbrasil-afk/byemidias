import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 });
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
