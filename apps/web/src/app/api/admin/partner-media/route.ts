import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


// GET /api/admin/partner-media — List pending partner media uploads
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const pb = await getAdminClient();
    const filters = [`status = "${status}"`];
    if (user.role !== 'super_admin') filters.push(`organization_id = "${user.organization_id}"`);
    const rows = (await pb.collection('partner_media_uploads').getList(1, 200, {
      filter: filters.join(' && '),
    })).items || [];

    const mediaIds = [...new Set(rows.map((r: any) => r.media_id).filter(Boolean))];
    const partnerIds = [...new Set(rows.map((r: any) => r.partner_access_id).filter(Boolean))];
    const mediaList = mediaIds.length > 0
      ? (await pb.collection('media').getList(1, 200, { filter: mediaIds.map((id: string) => `id = "${id}"`).join(' || ') })).items || []
      : [];
    const partnerList = partnerIds.length > 0
      ? (await pb.collection('partner_access').getList(1, 200, { filter: partnerIds.map((id: string) => `id = "${id}"`).join(' || ') })).items || []
      : [];
    const mediaMap = new Map(mediaList.map((m: any) => [m.id, m]));
    const partnerMap = new Map(partnerList.map((p: any) => [p.id, p]));
    const uploads = rows.map((row: any) => {
      const media: any = mediaMap.get(row.media_id) || {};
      const partner: any = partnerMap.get(row.partner_access_id) || {};
      return {
        ...row,
        partner_username: partner.username || '',
        partner_name: partner.display_name || '',
        media_name: media.name || row.file_name || '',
        media_type: media.type || row.file_type || '',
        file_url: media.file_url || media.url || row.file_url || '',
        file_size: media.file_size ?? row.file_size ?? 0,
      };
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/partner-media — Approve/reject partner media
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, rejection_reason } = body;

    if (!id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Rejection requires a reason (min 5 chars)
    if (status === 'rejected' && (!rejection_reason || String(rejection_reason).trim().length < 5)) {
      return NextResponse.json({ error: 'Informe o motivo da rejeição (mínimo 5 caracteres)' }, { status: 400 });
    }

    // Verify upload belongs to user's org (unless super_admin)
    let uploadOrgId: string | undefined;
    let uploadPartnerId: string | undefined;
    let uploadMediaId: string | undefined;
    let uploadMediaName: string | undefined;

    const [uploadInfo] = user.role !== 'super_admin'
      ? await sql`SELECT organization_id, partner_access_id, media_id FROM partner_media_uploads WHERE id = ${id}`
      : await sql`SELECT organization_id, partner_access_id, media_id FROM partner_media_uploads WHERE id = ${id}`;

    if (!uploadInfo) {
      return NextResponse.json({ error: 'Upload não encontrado' }, { status: 404 });
    }
    uploadOrgId = uploadInfo.organization_id;
    uploadPartnerId = uploadInfo.partner_access_id;
    uploadMediaId = uploadInfo.media_id;

    if (user.role !== 'super_admin' && uploadOrgId !== user.organization_id) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    }

    if (uploadMediaId) {
      const [m] = await sql`SELECT name FROM media WHERE id = ${uploadMediaId}`;
      uploadMediaName = m?.name;
    }

    // Update upload status with optional rejection reason
    await sql`
      UPDATE partner_media_uploads
      SET status = ${status}, rejection_reason = ${status === 'rejected' ? rejection_reason : null},
          reviewed_at = NOW(), reviewed_by = ${user.id}
      WHERE id = ${id}
    `;

    // If approved, ensure media record is active
    if (status === 'approved' && uploadMediaId) {
      await sql`UPDATE media SET status = 'active' WHERE id = ${uploadMediaId}`;
    }

    // If REJECTED: delete file from R2, remove media record, notify partner
    if (status === 'rejected' && uploadMediaId) {
      // 1. Send notification FIRST (while media_id is still valid for FK reference)
      if (uploadPartnerId && uploadOrgId) {
        const fileName = uploadMediaName || 'arquivo';
        const reason = rejection_reason || 'Não especificado';
        await sql`
          INSERT INTO partner_notifications (partner_access_id, organization_id, type, title, message, related_media_id)
          VALUES (
            ${uploadPartnerId}, ${uploadOrgId}, 'media_rejected',
            '❌ Mídia rejeitada',
            ${`Sua mídia "${fileName}" foi rejeitada.\n\nMotivo: ${reason}`},
            ${uploadMediaId}
          )
        `;
      }

      // 2. Delete file from R2
      try {
        const [mediaInfo] = await sql`SELECT file_url FROM media WHERE id = ${uploadMediaId}`;
        if (mediaInfo?.file_url) {
          const match = mediaInfo.file_url.match(/\/(media|partner-uploads)\/.+/);
          if (match) {
            const key = match[0].replace(/^\//, '');
            const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
            const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
            const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
            const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
            const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
            if (R2_ACCESS_KEY && R2_SECRET_KEY && R2_ACCOUNT_ID) {
              const r2 = new S3Client({
                region: 'auto',
                endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
              });
              try {
                await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
              } catch (e) {
                console.error('R2 delete failed:', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('R2 delete failed:', e);
      }

      // 3. Delete media record (FK on partner_notifications.related_media_id → ON DELETE SET NULL)
      try {
        await sql`DELETE FROM media WHERE id = ${uploadMediaId}`;
      } catch (e) {
        console.error('Media delete failed:', e);
      }
    }

    // Bump content_version so devices pick up the change
    if (uploadOrgId) bumpContentVersion(uploadOrgId).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
