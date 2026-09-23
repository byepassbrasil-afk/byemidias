import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    let healthOk = false;
    try {
      const hRes = await fetch(`${PB_URL}/api/health`, { cache: 'no-store' });
      healthOk = hRes.ok;
    } catch {}

    let collections: string[] = [];
    try {
      const pb = new PocketBase(PB_URL);
      pb.autoCancellation(false);
      const cols = await pb.collections.getList(1, 100);
      collections = cols.items.map((c: any) => c.name);
    } catch (e: any) {
      return Response.json({
        success: false,
        step: 'collections',
        error: e.message,
        pbUrl: PB_URL,
        healthOk,
      });
    }

    let adminOk = false;
    let adminErr: string | null = null;
    try {
      const pb = new PocketBase(PB_URL);
      pb.autoCancellation(false);
      await pb.admins.authWithPassword(
        process.env.PB_ADMIN_EMAIL || '',
        process.env.PB_ADMIN_PASSWORD || ''
      );
      adminOk = true;
    } catch (e: any) {
      adminErr = e.message;
    }

    return Response.json({
      success: true,
      pbUrl: PB_URL,
      elapsedMs: Date.now() - startTime,
      healthOk,
      collectionsCount: collections.length,
      collections,
      adminAuth: adminOk,
      adminError: adminErr,
      hasEmail: !!process.env.PB_ADMIN_EMAIL,
      hasPassword: !!process.env.PB_ADMIN_PASSWORD,
    });
  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
