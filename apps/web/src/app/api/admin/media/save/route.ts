import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
const ALLOWED_VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];

function getMediaTypeFromExt(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ALLOWED_IMAGE_EXTS.includes(ext)) return 'image';
  if (ALLOWED_VIDEO_EXTS.includes(ext)) return 'video';
  return 'image';
}

function sanitizeUuidArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const {
      file_name, file_url, file_size, organization_id,
      ttl_days, expires_reason, display_name, default_orientation,
      media_type,               // explicit type (auto-detect from file_name if missing)
      category_ids,             // primary/secondary category links (media_categories junction)
      excluded_category_ids,    // where NOT to show (by category)
      excluded_organization_ids,// where NOT to show (by specific org) — super_admin only
      excluded_device_ids,      // where NOT to show (by specific device/terminal) — super_admin only
    } = body;

    if (!file_url) return NextResponse.json({ error: 'file_url obrigatório' }, { status: 400 });
    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    // URL mídia: não exige upload, valida formato e não usa R2
    const isUrl = media_type === 'url' || /^https?:\/\//i.test(file_url || '');
    if (isUrl) {
      if (!/^https?:\/\/[^\s]+/i.test(file_url)) {
        return NextResponse.json({ error: 'URL inválida. Use http:// ou https://' }, { status: 400 });
      }
    }

    // ─── Authorization: cross-org blocking é exclusivo do super_admin ───
    const isSuperAdmin = user.role === 'super_admin';
    const safeExcludedOrgs = isSuperAdmin ? sanitizeUuidArray(excluded_organization_ids) : [];
    const safeExcludedDevices = isSuperAdmin ? sanitizeUuidArray(excluded_device_ids) : [];

    // Non-super_admin NÃO pode fazer upload pra outra org (só na própria)
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

    const sanitizedName = (file_name || 'upload')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    const customName = display_name ? String(display_name).trim().substring(0, 200) : null;

    const orientation = ['auto', 'portrait', 'landscape'].includes(default_orientation)
      ? default_orientation
      : 'auto';

    const mediaType = isUrl ? 'url' : getMediaTypeFromExt(file_name || file_url);

    let expiresAt: Date | null = null;
    if (ttl > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ttl);
    }

    const cleanCategoryIds = sanitizeUuidArray(category_ids);
    const cleanExcludedCats = sanitizeUuidArray(excluded_category_ids);

    const [media] = await sql`
      INSERT INTO media (
        organization_id, name, display_name, type, file_url, file_size, status,
        expires_at, expires_reason, default_orientation,
        excluded_category_ids, excluded_organization_ids, excluded_device_ids
      )
      VALUES (
        ${organization_id}, ${sanitizedName}, ${customName || sanitizedName}, ${mediaType},
        ${file_url}, ${isUrl ? 0 : (file_size || 0)}, 'active',
        ${expiresAt}, ${ttl === 0 ? expires_reason : null}, ${orientation},
        ${cleanExcludedCats.length > 0 ? sql.array(cleanExcludedCats) : null},
        ${safeExcludedOrgs.length > 0 ? sql.array(safeExcludedOrgs) : null},
        ${safeExcludedDevices.length > 0 ? sql.array(safeExcludedDevices) : null}
      )
      RETURNING id, name, display_name, type, file_url, file_size, status,
                expires_at, expires_reason, default_orientation,
                excluded_category_ids, excluded_organization_ids, excluded_device_ids, created_at
    `;

    // Link categories via media_categories junction (for "primary" categorization & filtering UI)
    if (cleanCategoryIds.length > 0 && media?.id) {
      for (const catId of cleanCategoryIds) {
        await sql`
          INSERT INTO media_categories (media_id, category_id)
          VALUES (${media.id}, ${catId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    bumpContentVersion(organization_id).catch(() => {});

    return NextResponse.json({ media });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/save error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
