import { NextResponse } from 'next/server';
import { validateOrgSlug } from '@/lib/partner-auth';
import sql from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { username, display_name, password, email } = body;

    if (!username || !password || !display_name) {
      return NextResponse.json({ error: 'Campos obrigatórios: username, display_name, password' }, { status: 400 });
    }

    const org = await validateOrgSlug(slug);
    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const [partner] = await sql`
        INSERT INTO partner_access (organization_id, username, display_name, password_hash, status, email)
        VALUES (${org.id}, ${username.toLowerCase().trim()}, ${display_name.trim()}, ${passwordHash}, 'active', ${email || null})
        RETURNING id, username, display_name, status, created_at
      `;

      return NextResponse.json({ partner, org: { id: org.id, name: org.name, slug } });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Este nome de usuário já existe nesta organização' }, { status: 409 });
      }
      return NextResponse.json({ error: err.message || 'Erro ao criar parceiro' }, { status: 500 });
    }
  } catch (error) {
    console.error('Partner signup error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
