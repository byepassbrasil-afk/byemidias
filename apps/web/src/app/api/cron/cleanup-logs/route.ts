import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COLLECTIONS = [
  { name: 'device_logs', field: 'created_at' },
  { name: 'device_uptime_sessions', field: 'started_at' },
  { name: 'playback_logs', field: 'timestamp' },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pb = await getAdminClient();
  const deleted: Record<string, number> = {};

  for (const { name, field } of COLLECTIONS) {
    let count = 0;
    try {
      while (true) {
        const page = await pb.collection(name).getList(1, 200, {
          filter: `${field} < "${cutoff}"`,
          sort: field,
        });
        if (page.items.length === 0) break;
        for (const item of page.items) {
          try {
            await pb.collection(name).delete(item.id);
            count++;
          } catch {}
        }
        if (page.items.length < 200) break;
      }
    } catch (e: any) {
      console.error(`[cleanup-logs] ${name}:`, e?.message || e);
    }
    deleted[name] = count;
  }

  return NextResponse.json({ cutoff, deleted });
}
