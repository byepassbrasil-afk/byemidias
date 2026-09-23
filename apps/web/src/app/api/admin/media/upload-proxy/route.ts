import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

// Singleton S3 client
let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3Client;
}

// POST: Gera URL pré-assinada para o browser fazer upload direto
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const filename = request.headers.get('x-filename') || `upload-${Date.now()}.bin`;
    const organizationId = request.headers.get('x-organization-id') || '';

    if (!organizationId) {
      return NextResponse.json({ error: 'x-organization-id header obrigatório' }, { status: 400 });
    }

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

    // Gerar URL pré-assinada (válida por 1 hora)
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      upload_url: presignedUrl,
      key,
      public_url: publicUrl,
      content_type: contentType,
      file_name: filename,
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[upload-proxy]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
