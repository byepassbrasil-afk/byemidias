import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { file_name, mime_type, file_url, file_size, organization_id } = body;

    if (!file_url) return NextResponse.json({ error: 'file_url obrigatório' }, { status: 400 });
    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    const sanitizedName = (file_name || 'upload')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    let mediaType = 'image';
    if (mime_type?.startsWith('video/')) mediaType = 'video';
    else if (mime_type?.startsWith('audio/')) mediaType = 'audio';

    const [media] = await sql`
      INSERT INTO media (organization_id, name, type, file_url, file_size, status)
      VALUES (${organization_id}, ${sanitizedName}, ${mediaType}, ${file_url}, ${file_size || 0}, 'active')
      RETURNING id, name, type, file_url, file_size, status, created_at
    `;

    return NextResponse.json({ media });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/save error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
