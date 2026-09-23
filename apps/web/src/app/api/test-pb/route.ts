import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export async function GET() {
  try {
    const pb = new PocketBase(PB_URL);

    // Test 1: Health check via fetch
    let healthOk = false;
    try {
      const hRes = await fetch(`${PB_URL}/api/health`);
      healthOk = hRes.ok;
    } catch (e: any) {
      return Response.json({ step: 'health', ok: false, error: e.message });
    }

    // Test 2: Admin auth
    let adminOk = false;
    try {
      await pb.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');
      adminOk = true;
    } catch (e: any) {
      return Response.json({ step: 'admin_auth', ok: false, error: e.message });
    }

    return Response.json({
      success: true,
      pbUrl: PB_URL,
      health: healthOk,
      adminAuth: adminOk,
    });
  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
