import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { createHmac, createHash } from 'crypto';

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function hexSha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
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

    const rawBody = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const file_name = body.file_name as string;
    const mime_type = body.mime_type as string;
    const organization_id = body.organization_id as string;

    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    const sanitizedName = (file_name || 'upload')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    const timestamp = Date.now();
    const ext = sanitizedName.split('.').pop() || 'bin';
    const key = `media/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;

    const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const contentType = mime_type || 'application/octet-stream';
    const expires = 3600;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateShort = amzDate.substring(0, 8);
    const credentialScope = `${dateShort}/${region}/s3/aws4_request`;

    const signedHeaders = 'host';

    // Build canonical query string (sorted alphabetically, EXCLUDE X-Amz-Signature)
    const queryParams = new URLSearchParams();
    queryParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    queryParams.set('X-Amz-Credential', `${R2_ACCESS_KEY}/${credentialScope}`);
    queryParams.set('X-Amz-Date', amzDate);
    queryParams.set('X-Amz-Expires', String(expires));
    queryParams.set('X-Amz-SignedHeaders', signedHeaders);

    // Canonical query string = sorted key=value pairs
    const canonicalQueryString = queryParams.toString().replace(/\+/g, '%20');

    const canonicalHeaders = `host:${host}\n`;
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      'PUT',
      `/${key}`,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hexSha256(canonicalRequest),
    ].join('\n');

    const kDate = hmac('AWS4' + R2_SECRET_KEY, dateShort);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = hmac(kSigning, stringToSign).toString('hex');

    queryParams.set('X-Amz-Signature', signature);

    const uploadUrl = `https://${host}/${key}?${queryParams.toString()}`;
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      upload_url: uploadUrl,
      key,
      public_url: publicUrl,
      content_type: contentType,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/admin/media/upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
