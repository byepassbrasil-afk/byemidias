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
  try {
    const pb = await authPB();

    const testCollection = 'test_playlists';

    // Ensure test collection exists
    try {
      await pb.collections.getOne(testCollection);
    } catch {
      await pb.collections.create({
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
    }

    // CREATE
    const created = await pb.collection(testCollection).create({
      name: 'Test CRUD Playlist',
      description: 'Created via test endpoint',
      status: 'active',
    });

    // READ
    const items = await pb.collection(testCollection).getList(1, 10);

    // UPDATE
    const updated = await pb.collection(testCollection).update(created.id, {
      description: 'Updated description',
    });

    // DELETE
    await pb.collection(testCollection).delete(created.id);

    return NextResponse.json({
      success: true,
      message: 'CRUD completo funcionou!',
      created: { id: created.id, name: created.name },
      totalItems: items.totalItems,
      updated: { id: updated.id, description: updated.description },
      deleted: true,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      data: e.data,
    }, { status: 500 });
  }
}
