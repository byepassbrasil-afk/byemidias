import { NextRequest, NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';
import { createHmac, createHash } from 'crypto';
import sql from '@/lib/db';

function hmacSign(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function hexSha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function generatePresignedUrl(key: string, host: string, R2_ACCESS_KEY: string, R2_SECRET_KEY: string) {
  const region = 'auto';
  const expires = 3600;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = amzDate.substring(0, 8);
  const credentialScope = `${dateShort}/${region}/s3/aws4_request`;
  const signedHeaders = 'host';

  const queryParams = new URLSearchParams();
  queryParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  queryParams.set('X-Amz-Credential', `${R2_ACCESS_KEY}/${credentialScope}`);
  queryParams.set('X-Amz-Date', amzDate);
  queryParams.set('X-Amz-Expires', String(expires));
  queryParams.set('X-Amz-SignedHeaders', signedHeaders);

  const canonicalQueryString = queryParams.toString().replace(/\+/g, '%20');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT', `/${key}`, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope, hexSha256(canonicalRequest),
  ].join('\n');

  const kDate = hmacSign('AWS4' + R2_SECRET_KEY, dateShort);
  const kRegion = hmacSign(kDate, region);
  const kService = hmacSign(kRegion, 's3');
  const kSigning = hmacSign(kService, 'aws4_request');
  const signature = hmacSign(kSigning, stringToSign).toString('hex');

  queryParams.set('X-Amz-Signature', signature);
  return `https://${host}/${key}?${queryParams.toString()}`;
}

function sanitizeName(name: string) {
  return (name || 'upload')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
}

function makeKey(partnerId: string, sanitizedName: string) {
  const timestamp = Date.now();
  const ext = sanitizedName.split('.').pop() || 'bin';
  return `partner-uploads/${partnerId}/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;
}

function getMediaType(mt: string) {
  if (mt?.startsWith('video/')) return 'video';
  if (mt?.startsWith('audio/')) return 'audio';
  return 'image';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // ?status=approved (default) returns only approved media.
    // ?status=all returns all partner uploads (including pending/rejected) for the partner's own view.
    const statusFilter = new URL(request.url).searchParams.get('status') ?? 'approved';

    let uploads;
    if (statusFilter === 'all') {
      uploads = await sql`SELECT media_id, status FROM partner_media_uploads WHERE partner_access_id = ${session.partnerAccessId} ORDER BY created_at DESC`;
    } else {
      uploads = await sql`SELECT media_id, status FROM partner_media_uploads WHERE partner_access_id = ${session.partnerAccessId} AND status = ${statusFilter} ORDER BY created_at DESC`;
    }
    const mediaIds = uploads.map((u) => u.media_id);

    if (mediaIds.length === 0) {
      return NextResponse.json({ media: [] });
    }

    const media = await sql`SELECT * FROM media WHERE id = ANY(${mediaIds}) ORDER BY created_at DESC`;
    // Attach upload_status to each media item
    const statusMap = new Map(uploads.map((u: Record<string, unknown>) => [u.media_id as string, u.status as string]));
    const mediaWithStatus = (media ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      upload_status: statusMap.get(m.id as string) ?? 'unknown',
    }));
    return NextResponse.json({ media: mediaWithStatus });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/partner/media error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
    const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

    if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return NextResponse.json({ error: 'R2 não configurado' }, { status: 500 });
    }

    // Accept JSON only — multipart would hit Vercel 4.5MB body limit.
    // Two-step flow: 1) get presigned URL, 2) upload directly to R2.
    const body = await request.json();
    const { file_name, mime_type, file_size, action, file_url } = body;

    if (action === 'presign') {
      // Step 1: generate presigned URL for direct browser-to-R2 upload
      if (!file_name || !mime_type) {
        return NextResponse.json({ error: 'file_name e mime_type obrigatórios' }, { status: 400 });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'image/avif'];
      if (!allowedTypes.includes(mime_type)) {
        return NextResponse.json({ error: 'Tipo não permitido' }, { status: 400 });
      }

      const sanitizedName = sanitizeName(file_name);
      const key = makeKey(session.partnerAccessId, sanitizedName);
      const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      const uploadUrl = generatePresignedUrl(key, host, R2_ACCESS_KEY, R2_SECRET_KEY);
      const publicUrl = `${R2_PUBLIC_URL}/${key}`;

      return NextResponse.json({
        upload_url: uploadUrl,
        key,
        public_url: publicUrl,
        content_type: mime_type,
        file_name: file_name,
        file_size: file_size || 0,
      });
    }

    if (action === 'save') {
      // Step 2: after direct upload to R2, save the media record
      if (!file_name || !file_url) {
        return NextResponse.json({ error: 'file_name e file_url obrigatórios' }, { status: 400 });
      }

      const mediaType = getMediaType(mime_type);

      const [mediaRecord] = await sql`
        INSERT INTO media (organization_id, name, type, file_url, file_size, status)
        VALUES (${session.organizationId}, ${file_name}, ${mediaType}, ${file_url}, ${file_size || 0}, 'active')
        RETURNING id
      `;

      await sql`INSERT INTO partner_media_uploads (partner_access_id, media_id, organization_id, status) VALUES (${session.partnerAccessId}, ${mediaRecord.id}, ${session.organizationId}, 'pending')`;

      return NextResponse.json({ success: true, mediaId: mediaRecord.id });
    }

    return NextResponse.json({ error: 'Ação inválida. Use "presign" ou "save".' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/partner/media error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
