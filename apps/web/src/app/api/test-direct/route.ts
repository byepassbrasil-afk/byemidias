import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const pb = await authPB();
    const orgId = '33058ec18d6fc1e';

    // Test 1: getList sem filter
    const allDevices = await pb.collection('devices').getList(1, 5);
    const test1 = { count: allDevices.items.length, ok: true };

    // Test 2: getList com filter
    const filtered = await pb.collection('devices').getList(1, 5, {
      filter: `organization_id = "${orgId}"`
    });
    const test2 = { count: filtered.items.length, ok: true };

    // Test 3: getFirstListItem
    let test3: any = { ok: false };
    try {
      const first = await pb.collection('devices').getFirstListItem(`organization_id = "${orgId}"`);
      test3 = { found: first.id, ok: true };
    } catch (e: any) {
      test3.error = e.message;
      test3.status = e.status;
    }

    return NextResponse.json({
      success: true,
      pbUrl: PB_URL,
      elapsedMs: Date.now() - startTime,
      tests: { allDevices: test1, filtered: test2, firstItem: test3 },
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
