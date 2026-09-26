import { NextResponse } from 'next/server';
import { validateOrgSlug } from '@/lib/partner-auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { username, display_name, password, email } = body;
    if (!username || !password || !display_name) return NextResponse.json({ error: 'Campos obrigatórios: username, display_name, password' }, { status: 400 });
    const org = await validateOrgSlug(slug);
    if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    const bcrypt = await import('bcryptjs');
    const pb = await getAdminClient();
    const collection = await pb.collections.getOne('partner_access');
    const existingFields = collection.fields || collection.schema || [];
    const missing = [
      { name: 'password_hash', type: 'text' },
      { name: 'status', type: 'text' },
    ].filter((f) => !existingFields.some((s: any) => s.name === f.name));
    if (missing.length > 0) await pb.collections.update('partner_access', { fields: [...existingFields, ...missing] });
    const normalized = username.toLowerCase().trim();
    const existing = await pb.collection('partner_access').getList(1, 200, { filter: `organization_id = "${org.id}"` });
    if ((existing.items || []).some((p: any) => String(p.username || '').toLowerCase().trim() === normalized)) {
      return NextResponse.json({ error: 'Este nome de usuário já existe nesta organização' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const partner = await pb.collection('partner_access').create({
      organization_id: org.id,
      username: normalized,
      display_name: display_name.trim(),
      email: email || '',
      password_hash: passwordHash,
      status: 'active',
      role: 'viewer',
    });
    return NextResponse.json({ partner, org: { id: org.id, name: org.name, slug } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 });
  }
}
