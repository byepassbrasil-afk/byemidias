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

async function ensureTestCollection(pb: PocketBase) {
  // First try to delete existing test_playlists to start fresh
  try {
    await pb.collections.delete('test_playlists');
  } catch {}
  
  // Create with null rules (allow all)
  await pb.collections.create({
    name: 'test_playlists',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'status', type: 'select', options: { values: ['active', 'inactive'] } },
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
}

export async function GET() {
  const steps: any[] = [];
  try {
    const pb = await authPB();
    steps.push({ step: 'auth_ok' });

    const testCollection = 'test_playlists';

    // Ensure test collection exists with proper rules
    try {
      ensureTestCollection(pb);
      steps.push({ step: 'collection_ensured' });
    } catch (e: any) {
      steps.push({ step: 'collection_failed', error: e.message });
      return NextResponse.json({ success: false, error: e.message, steps }, { status: 500 });
    }

    // CREATE
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
    try {
      await pb.collection(testCollection).delete(created.id);
      steps.push({ step: 'deleted' });
    } catch (e: any) {
      steps.push({ step: 'delete_error', status: e.status, msg: e.message, data: e.data });
      return NextResponse.json({
        success: false,
        error: 'Delete failed: ' + e.message,
        steps,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'CRUD completo funcionou!',
      steps,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500),
      steps,
    }, { status: 500 });
  }
}
