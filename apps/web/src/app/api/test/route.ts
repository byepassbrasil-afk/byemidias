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
    let collectionsErr: string | null = null;
    try {
      const pb = new PocketBase(PB_URL);
      pb.autoCancellation(false);
      const cols = await pb.collections.getList(1, 100);
      collections = cols.items.map((c: any) => c.name);
    } catch (e: any) {
      collectionsErr = e.message;
    }

    let superuserOk = false;
    let superuserErr: string | null = null;
    try {
      const pb = new PocketBase(PB_URL);
      pb.autoCancellation(false);
      await pb.collection('_superusers').authWithPassword(
        process.env.PB_ADMIN_EMAIL || '',
        process.env.PB_ADMIN_PASSWORD || ''
      );
      superuserOk = true;
    } catch (e: any) {
      superuserErr = e.message;
      if (e.status === 404) {
        try {
          const pb = new PocketBase(PB_URL);
          pb.autoCancellation(false);
          await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || '',
            process.env.PB_ADMIN_PASSWORD || ''
          );
          superuserOk = true;
          superuserErr = null;
        } catch (e2: any) {
          superuserErr = e2.message;
        }
      }
    }

    return Response.json({
      success: true,
      pbUrl: PB_URL,
      elapsedMs: Date.now() - startTime,
      healthOk,
      collectionsCount: collections.length,
      collections,
      collectionsErr,
      superuserAuth: superuserOk,
      superuserError: superuserErr,
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
