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

    // 2. Try to delete from R2; if R2 isn't configured, mark as deleted anyway (DB-only cleanup)
    let client: S3Client | null = null;
    let bucket = '';
    try {
      const r2 = getR2();
      client = r2.client;
      bucket = r2.bucket;
    } catch (e: any) {
      console.warn('[cleanup-files] R2 não configurado, marcando como deleted no DB apenas:', e.message);
    }

    const deletedKeys: string[] = [];
    const failed: string[] = [];

    for (const m of expired) {
      try {
        // Try to delete from R2 if configured
        if (client && m.file_url) {
          try {
            // URL format: https://pub-xxx.r2.dev/media/123_file.jpg
            const match = m.file_url.match(/\/(media|partner-uploads)\/.+/);
            if (match) {
              const key = match[0].replace(/^\//, '');
              await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
              deletedKeys.push(m.id);
            } else {
              console.warn(`[cleanup-files] Could not extract R2 key from URL: ${m.file_url}`);
            }
          } catch (r2Err: any) {
            console.error(`[cleanup-files] R2 delete failed for ${m.id}:`, r2Err.message);
            failed.push(m.id);
            continue;
          }
        } else {
          deletedKeys.push(m.id); // conta como "deletado" mesmo sem R2
        }

        // 3. HARD delete from DB (libera espaço em índices e remove referência para sempre)
        await sql`DELETE FROM media WHERE id = ${m.id}`;
      } catch (err: any) {
        console.error(`[cleanup-files] Failed to cleanup media ${m.id}:`, err.message);
        failed.push(m.id);
      }
    }

    return NextResponse.json({
      deleted: deletedKeys.length,
      failed: failed.length,
      r2_configured: !!client,
      ids: deletedKeys,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Cron cleanup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
