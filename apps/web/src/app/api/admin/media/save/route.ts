import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
const ALLOWED_VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];

function getMediaTypeFromExt(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ALLOWED_IMAGE_EXTS.includes(ext)) return 'image';
  if (ALLOWED_VIDEO_EXTS.includes(ext)) return 'video';
  return 'image';
}

function sanitizeName(name: string) {
  return (name || 'upload')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const {
      file_name, file_url, file_size, organization_id,
      ttl_days, expires_reason, display_name, default_orientation,
      media_type,
      thumbnail_url,
      category_ids,
    } = body;

    if (!file_url) return NextResponse.json({ error: 'file_url obrigatório' }, { status: 400 });
    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    // URL mídia: não exige upload, valida formato
    const isUrl = media_type === 'url' || /^https?:\/\//i.test(file_url || '');
    if (isUrl) {
      if (!/^https?:\/\/[^\s]+/i.test(file_url)) {
        return NextResponse.json({ error: 'URL inválida. Use http:// ou https://' }, { status: 400 });
      }
    }

    // Authorization
    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin && user.organization_id !== organization_id) {
      return NextResponse.json({
        error: 'Você só pode fazer upload de mídia para a sua própria organização.'
      }, { status: 403 });
    }

    const ttl = ttl_days !== undefined && ttl_days !== null ? Number(ttl_days) : 7;

    if (ttl === 0) {
      if (!expires_reason || String(expires_reason).trim().length < 10) {
        return NextResponse.json({
          error: 'Para manter para sempre é obrigatório justificar com pelo menos 10 caracteres no campo "Motivo".'
        }, { status: 400 });
      }
    }

    const sanitizedName = sanitizeName(file_name);
    const customName = display_name ? String(display_name).trim().substring(0, 200) : sanitizedName;
    const orientation = ['auto', 'portrait', 'landscape'].includes(default_orientation)
      ? default_orientation
      : 'auto';
    const resolvedType = isUrl ? 'url' : getMediaTypeFromExt(file_name || file_url);

    let expiresAt: string | null = null;
    if (ttl > 0) {
      const d = new Date();
      d.setDate(d.getDate() + ttl);
      expiresAt = d.toISOString();
    }

    const pb = await getAdminClient();

    // Criar registro na collection media
    const mediaData: any = {
      name: sanitizedName,
      organization_id,
      url: file_url,
      type: resolvedType,
      status: 'active',
    };
    if (thumbnail_url) mediaData.thumbnail_url = thumbnail_url;

    const media = await pb.collection('media').create(mediaData);

    // Link categorias via media_categories
    if (Array.isArray(category_ids) && category_ids.length > 0 && media?.id) {
      for (const catId of category_ids) {
        try {
          await pb.collection('media_categories').create({
            device_id: '', // Campo conforme schema
            category_id: catId,
          });
        } catch (e) {
          // Ignora se falhar
        }
      }
    }

    return NextResponse.json({ media });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[media save] erro:', msg, e.data);
    return NextResponse.json({ error: msg, data: e.data }, { status: 500 });
  }
}
