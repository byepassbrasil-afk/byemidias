import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { deleteObject, deleteObjects, publicUrlFor, renameObject } from '@/lib/r2';

export async function DELETE(request: NextRequest) {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  try {
    const body = await request.json();
    const { keys } = body;
    if (Array.isArray(keys) && keys.length > 0) {
      const result = await deleteObjects(keys);
      return NextResponse.json({ success: true, deleted: result.deleted, errors: result.errors });
    }
    const { key } = body;
    if (typeof key === 'string' && key) {
      await deleteObject(key);
      return NextResponse.json({ success: true, deleted: 1 });
    }
    return NextResponse.json({ error: 'key ou keys obrigatório' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Storage delete error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  try {
    const body = await request.json();
    const { source_key, dest_key } = body;
    if (typeof source_key !== 'string' || typeof dest_key !== 'string' || !source_key || !dest_key) {
      return NextResponse.json({ error: 'source_key e dest_key obrigatórios' }, { status: 400 });
    }
    if (source_key === dest_key) {
      return NextResponse.json({ error: 'Origem e destino iguais' }, { status: 400 });
    }
    await renameObject(source_key, dest_key);
    return NextResponse.json({ success: true, new_key: dest_key, public_url: publicUrlFor(dest_key) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Storage rename error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
