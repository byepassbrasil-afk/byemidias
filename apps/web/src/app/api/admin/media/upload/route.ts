import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { createHmac, createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para upload

function hmacSign(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

function hexSha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

async function uploadToR2(
  key: string,
  fileBuffer: Buffer,
  contentType: string,
  R2_ACCESS_KEY: string,
  R2_SECRET_KEY: string,
  R2_BUCKET: string,
  R2_ACCOUNT_ID: string
): Promise<string> {
  const region = 'auto';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = amzDate.substring(0, 8);
  const credentialScope = `${dateShort}/${region}/s3/aws4_request`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const payloadHash = createHash('sha256').update(fileBuffer).digest('hex');
  const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    'PUT', `/${key}`, '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope, hexSha256(canonicalRequest),
  ].join('\n');

  const kDate = hmacSign('AWS4' + R2_SECRET_KEY, dateShort);
  const kRegion = hmacSign(kDate, region);
  const kService = hmacSign(kRegion, 's3');
  const kSigning = hmacSign(kService, 'aws4_request');
  const signature = hmacSign(kSigning, stringToSign);

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const uploadUrl = `https://${host}/${key}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader,
      'Content-Type': contentType,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
  }

  return uploadUrl;
}

const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif'];
const ALLOWED_VIDEO_EXTS = ['mp4', 'avi', 'wmv', 'mkv'];
const ALLOWED_ALL_EXTS = [...ALLOWED_IMAGE_EXTS, ...ALLOWED_VIDEO_EXTS];

function getMediaTypeFromExt(ext: string): string | null {
  const e = ext.toLowerCase();
  if (ALLOWED_IMAGE_EXTS.includes(e)) return 'image';
  if (ALLOWED_VIDEO_EXTS.includes(e)) return 'video';
  return null;
}

function sanitizeName(name: string) {
  return (name || 'upload')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
}

function makeKey(sanitizedName: string) {
  const timestamp = Date.now();
  const ext = sanitizedName.split('.').pop() || 'bin';
  return `media/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;
}

// POST: Upload via URL pública
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
    const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
    const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

    if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return NextResponse.json({ error: 'R2 credentials not configured' }, { status: 500 });
    }

    const ct = request.headers.get('content-type') || '';

    // ROTA 1: Upload via multipart/form-data (server-side)
    if (ct.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const organization_id = formData.get('organization_id') as string | null;

        if (!file) {
          return NextResponse.json({ error: 'file obrigatório' }, { status: 400 });
        }
        if (!organization_id) {
          return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });
        }

        // Validar extensão
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const mediaType = getMediaTypeFromExt(ext);
        if (!mediaType) {
          return NextResponse.json({
            error: `Extensão .${ext} não permitida. Use: ${ALLOWED_ALL_EXTS.join(', ')}`
          }, { status: 400 });
        }

        const sanitizedName = sanitizeName(file.name);
        const key = makeKey(sanitizedName);
        const contentType = file.type || 'application/octet-stream';
        const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

        // Upload server-side via fetch (bypassa CORS)
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await uploadToR2(key, fileBuffer, contentType, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_ACCOUNT_ID);
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        return NextResponse.json({
          success: true,
          upload_url: `${host}/${key}`,
          key,
          public_url: publicUrl,
          content_type: contentType,
          file_name: file.name,
          file_size: file.size,
          organization_id,
          resolved_type: mediaType,
        });
      } catch (e: any) {
        console.error('[media upload] multipart error:', e.message);
        if (e.message?.includes('exceeded') || e.message?.includes('413')) {
          return NextResponse.json({ error: 'Arquivo muito grande. Limite: 4.5MB' }, { status: 413 });
        }
        return NextResponse.json({ error: e.message || 'Erro no upload' }, { status: 500 });
      }
    }

    // ROTA 2: Upload via URL pública (sem upload de arquivo)
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const file_name = body.file_name as string;
    const file_url = body.file_url as string;
    const mime_type = body.mime_type as string;
    const organization_id = body.organization_id as string;

    if (!organization_id) {
      return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });
    }

    if (file_url) {
      // Upload via URL pública
      if (!/^https?:\/\//i.test(file_url)) {
        return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        upload_url: file_url,
        public_url: file_url,
        content_type: mime_type || 'application/octet-stream',
        resolved_type: 'url',
      });
    }

    return NextResponse.json({ error: 'file obrigatório' }, { status: 400 });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
