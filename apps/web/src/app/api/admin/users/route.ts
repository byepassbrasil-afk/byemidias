import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, full_name, role, organization_id } = body;

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, senha e nome são obrigatórios' }, { status: 400 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // For now, look up caller by session cookie or token
  // TODO: Replace with proper auth middleware
  const [callerProfile] = await sql`SELECT id, email, role FROM profiles LIMIT 1`;

  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super admin pode criar usuários' }, { status: 403 });
  }

  // Create user profile directly (no Supabase Auth)
  const userId = randomUUID();
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);

  // Store password hash in a user_account or use profiles table
  const [profile] = await sql`
    INSERT INTO profiles (id, email, full_name, role, organization_id, status, password_hash)
    VALUES (${userId}, ${email}, ${full_name}, ${role || 'viewer'}, ${organization_id || null}, 'active', ${passwordHash})
    RETURNING id, email, full_name, role
  `;

  return NextResponse.json({ user: profile });
}
