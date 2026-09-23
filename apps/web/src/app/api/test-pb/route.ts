import PocketBase from 'pocketbase';

const PB_URL = 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export async function GET() {
  const pb = new PocketBase(PB_URL);

  try {
    // Test health
    const healthRes = await fetch(`${PB_URL}/api/health`);
    const health = await healthRes.json();

    // Test admin auth
    await pb.admins.authWithPassword('gwmorata@gmail.com', '@Gaedaam08');

    // Get collections
    const collections = await pb.collections.getList(1, 100);

    return Response.json({
      success: true,
      health,
      adminAuth: true,
      collectionsCount: collections.items.length,
    });
  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message,
      stack: e.stack,
    }, { status: 500 });
  }
}
