import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
const ALLOWED_VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];

function getMediaTypeFromExt(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ALLOWED_IMAGE_EXTS.includes(ext)) return 'image';
  if (ALLOWED_VIDEO_EXTS.includes(ext)) return 'video';
  return 'image'; // default to image for safe extensionless URLs
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { file_name, file_url, file_size, organization_id, ttl_days } = body;

    if (!file_url) return NextResponse.json({ error: 'file_url obrigatório' }, { status: 400 });
    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    const sanitizedName = (file_name || 'upload')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    const mediaType = getMediaTypeFromExt(file_name || file_url);

    // ttl_days: null/undefined/0 = forever, else = days until deletion
    let expiresAt: Date | null = null;
    if (ttl_days && Number(ttl_days) > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(ttl_days));
    }

    const [media] = await sql`
      INSERT INTO media (organization_id, name, type, file_url, file_size, status, expires_at)
      VALUES (${organization_id}, ${sanitizedName}, ${mediaType}, ${file_url}, ${file_size || 0}, 'active', ${expiresAt})
      RETURNING id, name, type, file_url, file_size, status, expires_at, created_at
    `;

    bumpContentVersion(organization_id).catch(() => {});

    return NextResponse.json({ media });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/save error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
