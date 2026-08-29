import { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

function getR2Config() {
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
  const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID) {
    throw new Error('R2 credentials not configured');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });

  return { client, bucket: R2_BUCKET, publicUrl: R2_PUBLIC_URL };
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

export interface R2Folder {
  prefix: string;
  name: string;
}

export interface ListResult {
  objects: R2Object[];
  folders: R2Folder[];
  totalSize: number;
}

/**
 * List objects under a prefix. Returns files and "folders" (common prefixes).
 * prefix should NOT include trailing slash unless it's a folder.
 */
export async function listObjects(prefix: string, maxKeys: number = 1000): Promise<ListResult> {
  const { client, bucket } = getR2Config();
  const normalizedPrefix = prefix && !prefix.endsWith('/') && prefix !== '' ? prefix + '/' : prefix;

  const cmd = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: normalizedPrefix,
    Delimiter: '/',
    MaxKeys: maxKeys,
  });

  const res = await client.send(cmd);
  const objects: R2Object[] = (res.Contents ?? [])
    .filter(o => o.Key !== normalizedPrefix)
    .map(o => ({
      key: o.Key ?? '',
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? '',
      etag: (o.ETag ?? '').replace(/"/g, ''),
    }));
  const folders: R2Folder[] = (res.CommonPrefixes ?? []).map(p => ({
    prefix: p.Prefix ?? '',
    name: (p.Prefix ?? '').replace(normalizedPrefix, '').replace(/\/$/, ''),
  }));

  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
  return { objects, folders, totalSize };
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getR2Config();
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(cmd);
}

export async function deleteObjects(keys: string[]): Promise<{ deleted: number; errors: string[] }> {
  const { client, bucket } = getR2Config();
  const cmd = new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: {
      Objects: keys.map(Key => ({ Key })),
      Quiet: false,
    },
  });
  const res = await client.send(cmd);
  const deleted = (res.Deleted ?? []).length;
  const errors = (res.Errors ?? []).map(e => `${e.Key}: ${e.Message}`);
  return { deleted, errors };
}

/**
 * Rename/move an object. R2 has no atomic rename, so copy then delete.
 */
export async function renameObject(sourceKey: string, destKey: string): Promise<void> {
  const { client, bucket } = getR2Config();
  // Copy
  const copyCmd = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `/${bucket}/${encodeURIComponent(sourceKey)}`,
    Key: destKey,
  });
  await client.send(copyCmd);
  // Delete original
  const delCmd = new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey });
  await client.send(delCmd);
}

export function publicUrlFor(key: string): string {
  const { publicUrl } = getR2Config();
  return `${publicUrl}/${key}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
