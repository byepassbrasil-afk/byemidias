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

export async function GET() {
  const steps: any[] = [];
  try {
    const pb = await authPB();
    steps.push({ step: 'auth_ok' });

    const testCollection = 'test_playlists';

    // Ensure test collection exists
    try {
      const existing = await pb.collections.getOne(testCollection);
      steps.push({ step: 'collection_exists', id: existing.id });
    } catch (e: any) {
      steps.push({ step: 'collection_get_failed', status: e.status, msg: e.message });
      try {
        const created = await pb.collections.create({
          name: testCollection,
          type: 'base',
          schema: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'text' },
            { name: 'status', type: 'select', options: { values: ['active', 'inactive'] } },
          ],
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: '',
        });
        steps.push({ step: 'collection_created', id: created.id });
      } catch (e2: any) {
        steps.push({ step: 'collection_create_failed', status: e2.status, msg: e2.message, data: e2.data });
        return NextResponse.json({ success: false, error: 'Cannot create collection', steps }, { status: 500 });
      }
    }

    // CREATE
    try {
      const created = await pb.collection(testCollection).create({
        name: 'Test CRUD Playlist',
        description: 'Created via test endpoint',
        status: 'active',
      });
      steps.push({ step: 'created', id: created.id });

      // READ
      const items = await pb.collection(testCollection).getList(1, 10);
      steps.push({ step: 'read', count: items.totalItems });

      // UPDATE
      const updated = await pb.collection(testCollection).update(created.id, {
        description: 'Updated description',
      });
      steps.push({ step: 'updated', id: updated.id });

      // DELETE
      await pb.collection(testCollection).delete(created.id);
      steps.push({ step: 'deleted' });

      return NextResponse.json({
        success: true,
        message: 'CRUD completo funcionou!',
        steps,
      });
    } catch (e: any) {
      steps.push({ step: 'crud_error', status: e.status, msg: e.message, data: e.data });
      return NextResponse.json({
        success: false,
        error: e.message,
        status: e.status,
        data: e.data,
        steps,
      }, { status: 500 });
    }
  } catch (e: any) {
    steps.push({ step: 'outer_error', status: e.status, msg: e.message });
    return NextResponse.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
      steps,
    }, { status: 500 });
  }
}
