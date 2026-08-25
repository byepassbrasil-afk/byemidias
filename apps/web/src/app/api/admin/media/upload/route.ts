import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
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

function makeKey(sanitizedName: string) {
  const timestamp = Date.now();
  const ext = sanitizedName.split('.').pop() || 'bin';
  return `media/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;
}

function getMediaType(mt: string) {
  if (mt?.startsWith('video/')) return 'video';
  if (mt?.startsWith('audio/')) return 'audio';
  return 'image';
}

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

    if (ct.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const organization_id = formData.get('organization_id') as string | null;

      if (!file) return NextResponse.json({ error: 'file obrigatório' }, { status: 400 });
      if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

      const sanitizedName = sanitizeName(file.name);
      const key = makeKey(sanitizedName);
      const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      const uploadUrl = generatePresignedUrl(key, host, R2_ACCESS_KEY, R2_SECRET_KEY);
      const publicUrl = `${R2_PUBLIC_URL}/${key}`;

      return NextResponse.json({
        upload_url: uploadUrl, key, public_url: publicUrl,
        content_type: file.type || 'application/octet-stream',
        file_name: file.name, file_size: file.size, organization_id,
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const file_name = body.file_name as string;
    const mime_type = body.mime_type as string;
    const organization_id = body.organization_id as string;

    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    const sanitizedName = sanitizeName(file_name);
    const key = makeKey(sanitizedName);
    const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const uploadUrl = generatePresignedUrl(key, host, R2_ACCESS_KEY, R2_SECRET_KEY);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      upload_url: uploadUrl, key, public_url: publicUrl,
      content_type: mime_type || 'application/octet-stream',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
