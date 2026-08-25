import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { file_name, mime_type, file_size, organization_id } = body;

    if (!organization_id) return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });

    const sanitizedName = (file_name || 'upload')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    const timestamp = Date.now();
    const ext = sanitizedName.split('.').pop() || 'bin';
    const key = `media/${timestamp}_${sanitizedName.replace(/\.[^.]+$/, '')}.${ext}`;

    const contentType = mime_type || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET || 'byemidias',
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL || ''}/${key}`;

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
