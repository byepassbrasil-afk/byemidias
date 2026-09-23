import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export const dynamic = 'force-dynamic';

async function authPB(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection('_superusers').authWithPassword(
      process.env.PB_ADMIN_EMAIL || '',
      process.env.PB_ADMIN_PASSWORD || ''
    );
  } catch (e: any) {
    if (e.status === 404) {
      await pb.admins.authWithPassword(
        process.env.PB_ADMIN_EMAIL || '',
        process.env.PB_ADMIN_PASSWORD || ''
      );
    } else {
      throw e;
    }
  }
  return pb;
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Test 1: Direct fetch health check
    let healthOk = false;
    let healthError: string | null = null;
    try {
      const hRes = await fetch(`${PB_URL}/api/health`, { cache: 'no-store' });
      healthOk = hRes.ok;
      if (!healthOk) healthError = `Status ${hRes.status}`;
    } catch (e: any) {
      healthError = e.message;
    }

    // Test 2: PocketBase SDK
    let sdkOk = false;
    let sdkError: string | null = null;
    let collections: string[] = [];
    try {
      const pb = new PocketBase(PB_URL);
      pb.autoCancellation(false);
      const cols = await pb.collections.getList(1, 100);
      collections = cols.items.map((c: any) => c.name);
      sdkOk = true;
    } catch (e: any) {
      sdkError = e.message;
    }

    // Test 3: Superuser auth
    let adminOk = false;
    let adminError: string | null = null;
    try {
      const pb = await authPB();
      adminOk = true;
    } catch (e: any) {
      adminError = e.message;
    }

    return Response.json({
      success: true,
      pbUrl: PB_URL,
      hasCredentials: !!process.env.PB_ADMIN_EMAIL && !!process.env.PB_ADMIN_PASSWORD,
      elapsedMs: Date.now() - startTime,
      tests: {
        health: { ok: healthOk, error: healthError },
        sdk: { ok: sdkOk, error: sdkError },
        superuserAuth: { ok: adminOk, error: adminError },
      },
      collections,
      envKeys: Object.keys(process.env).filter(k => k.startsWith('PB_')),
    });
  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
