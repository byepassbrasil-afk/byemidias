import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getR2() {
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
  const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID) {
    throw new Error('R2 não configurado');
  }
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    }),
    bucket: R2_BUCKET,
  };
}

/**
 * Vercel Cron job — runs daily at 03:00 UTC (configured in vercel.json).
 * Deletes media files whose expires_at has passed.
 */
export async function GET(request: Request) {
  // Verify Vercel cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 1. Find expired media
    const expired = await sql`
      SELECT id, organization_id, name, file_url
      FROM media
      WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status = 'active'
      LIMIT 100
    ` as Array<{ id: string; organization_id: string; name: string; file_url: string }>;

    if (expired.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No expired files' });
    }

    // 2. Delete from R2
    const { client, bucket } = getR2();
    const deletedKeys: string[] = [];
    const failed: string[] = [];

    for (const m of expired) {
      try {
        // Extract R2 key from public URL
        // URL format: https://pub-xxx.r2.dev/media/123_file.jpg
        const match = m.file_url.match(/\/(media|partner-uploads)\/.+/);
        if (!match) {
          failed.push(m.id);
          continue;
        }
        const key = match[0].replace(/^\//, '');

        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        deletedKeys.push(m.id);

        // 3. Soft-delete from DB (set status to 'deleted' for audit trail)
        await sql`UPDATE media SET status = 'deleted' WHERE id = ${m.id}`;
      } catch (err) {
        console.error(`Failed to delete media ${m.id}:`, err);
        failed.push(m.id);
      }
    }

    return NextResponse.json({
      deleted: deletedKeys.length,
      failed: failed.length,
      ids: deletedKeys,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Cron cleanup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
