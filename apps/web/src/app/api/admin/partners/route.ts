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
        SELECT pa.id, pa.username, pa.display_name, pa.name as display_name_fallback, pa.status, pa.created_at, pa.updated_at, pa.category_id,
          c.name as category_name, c.icon as category_icon, c.color as category_color, c.slug as category_slug,
          COALESCE((SELECT json_agg(json_build_object(
            'id', pd.id, 'device_id', pd.device_id, 'playlist_id', pd.playlist_id
          )) FROM partner_devices pd WHERE pd.partner_access_id = pa.id), '[]'::json) as partner_devices
        FROM partner_access pa
        LEFT JOIN categories c ON c.id = pa.category_id
        WHERE pa.organization_id = ${profile.organization_id}
        ORDER BY pa.created_at DESC
      `;
    } else {
      partners = await sql`
        SELECT pa.id, pa.username, pa.display_name, pa.name as display_name_fallback, pa.status, pa.created_at, pa.updated_at, pa.category_id,
          c.name as category_name, c.icon as category_icon, c.color as category_color, c.slug as category_slug,
          COALESCE((SELECT json_agg(json_build_object(
            'id', pd.id, 'device_id', pd.device_id, 'playlist_id', pd.playlist_id
          )) FROM partner_devices pd WHERE pd.partner_access_id = pa.id), '[]'::json) as partner_devices
        FROM partner_access pa
        LEFT JOIN categories c ON c.id = pa.category_id
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
    const { username, display_name, password, category_id } = body;

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

    // Determina a categoria do parceiro:
    // 1. Se informado, usa esse
    // 2. Se não, usa a "Padrão" da org
    let finalCategoryId: string | null = category_id || null;
    if (!finalCategoryId && orgId) {
      const [defaultCat] = await sql`
        SELECT id FROM categories
        WHERE is_default = TRUE AND organization_id = ${orgId}
        LIMIT 1
      `;
      finalCategoryId = defaultCat?.id || null;
    }
    // Fallback final: usa a global
    if (!finalCategoryId) {
      const [globalDefault] = await sql`
        SELECT id FROM categories WHERE is_default = TRUE AND organization_id IS NULL LIMIT 1
      `;
      finalCategoryId = globalDefault?.id || null;
    }

    try {
      const [partner] = await sql`
        INSERT INTO partner_access (organization_id, username, display_name, password_hash, status, category_id)
        VALUES (${orgId}, ${username.toLowerCase().trim()}, ${display_name.trim()}, ${passwordHash}, 'active', ${finalCategoryId})
        RETURNING id, username, display_name, status, category_id, created_at
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
