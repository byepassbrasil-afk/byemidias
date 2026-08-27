import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT organization_id, role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    let partners;
    if (profile.role !== 'super_admin' && profile.organization_id) {
      partners = await sql`
        SELECT pa.id, pa.username, pa.display_name, pa.name as display_name_fallback, pa.status, pa.created_at, pa.updated_at,
          COALESCE((SELECT json_agg(json_build_object(
            'id', pd.id, 'device_id', pd.device_id, 'playlist_id', pd.playlist_id
          )) FROM partner_devices pd WHERE pd.partner_access_id = pa.id), '[]'::json) as partner_devices
        FROM partner_access pa
        WHERE pa.organization_id = ${profile.organization_id}
        ORDER BY pa.created_at DESC
      `;
    } else {
      partners = await sql`
        SELECT pa.id, pa.username, pa.display_name, pa.name as display_name_fallback, pa.status, pa.created_at, pa.updated_at,
          COALESCE((SELECT json_agg(json_build_object(
            'id', pd.id, 'device_id', pd.device_id, 'playlist_id', pd.playlist_id
          )) FROM partner_devices pd WHERE pd.partner_access_id = pa.id), '[]'::json) as partner_devices
        FROM partner_access pa
        ORDER BY pa.created_at DESC
      `;
    }

    return NextResponse.json({ partners: partners ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/admin/partners error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT organization_id, role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { username, display_name, password } = body;

    if (!username || !password || !display_name) {
      return NextResponse.json({ error: 'Campos obrigatórios: username, display_name, password' }, { status: 400 });
    }

    let passwordHash: string | null = null;

    try {
      const [hashResult] = await sql`SELECT hash_partner_password(${password}) as hash`;
      passwordHash = hashResult?.hash;
    } catch {
      // RPC may not work via pooler
    }

    if (!passwordHash) {
      const bcrypt = await import('bcryptjs');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const orgId = profile.role === 'super_admin' ? profile.organization_id : profile.organization_id;

    try {
      const [partner] = await sql`
        INSERT INTO partner_access (organization_id, username, display_name, password_hash, status)
        VALUES (${orgId}, ${username.toLowerCase().trim()}, ${display_name.trim()}, ${passwordHash}, 'active')
        RETURNING id, username, display_name, status, created_at
      `;

      return NextResponse.json({ partner });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('Insert error:', error);
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Este nome de usuário já existe' }, { status: 409 });
      }
      return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/partners error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
