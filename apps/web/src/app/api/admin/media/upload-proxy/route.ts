import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { createHmac, createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

function hmacSign(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

function hexSha256(data: Buffer): string {
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

    // Pega o body bruto (raw body)
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    const filename = request.headers.get('x-filename') || `upload-${Date.now()}.bin`;
    const organizationId = request.headers.get('x-organization-id') || '';

    if (!organizationId) {
      return NextResponse.json({ error: 'x-organization-id header obrigatório' }, { status: 400 });
    }

    // Limite de tamanho (50MB por arquivo)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (contentLength > MAX_SIZE) {
      return NextResponse.json({ error: `Arquivo muito grande. Limite: ${MAX_SIZE / 1024 / 1024}MB` }, { status: 413 });
    }

    // Ler o body como Buffer
    const arrayBuffer = await request.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Validar extensão
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const ALLOWED = ['png', 'jpg', 'jpeg', 'avif', 'webp', 'gif', 'mp4', 'avi', 'wmv', 'mkv'];
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json({ error: `Extensão .${ext} não permitida` }, { status: 400 });
    }

    // Gerar key
    const sanitizedName = filename
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
    const timestamp = Date.now();
    const key = `media/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;

    const region = 'auto';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateShort = amzDate.substring(0, 8);
    const credentialScope = `${dateShort}/${region}/s3/aws4_request`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const payloadHash = hexSha256(fileBuffer);
    const host = `${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const canonicalRequest = [
      'PUT', `/${key}`, '', canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = hmacSign('AWS4' + R2_SECRET_KEY, dateShort);
    const kRegion = hmacSign(kDate, region);
    const kService = hmacSign(kRegion, 's3');
    const kSigning = hmacSign(kService, 'aws4_request');
    const signature = hmacSign(kSigning, stringToSign) as unknown as string;

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
      return NextResponse.json({ error: `R2 upload failed: ${response.status} ${errorText}` }, { status: 500 });
    }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      key,
      public_url: publicUrl,
      file_size: fileBuffer.length,
      content_type: contentType,
      file_name: filename,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[upload-proxy]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
