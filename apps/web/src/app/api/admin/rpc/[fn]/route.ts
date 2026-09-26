import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


const ALLOWED_FUNCTIONS = ['bump_device_content_version'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ fn: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { fn } = await params;
    if (!ALLOWED_FUNCTIONS.includes(fn)) {
      return NextResponse.json({ error: 'Função não permitida' }, { status: 403 });
    }

    const body = await request.json();
    const { target_device_id } = body;

    if (!target_device_id) {
      return NextResponse.json({ error: 'target_device_id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();
    const device = await pb.collection('devices').getOne(target_device_id);
    if (user.role !== 'super_admin' && device.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const contentVersion = Date.now();
    const updated = await pb.collection('devices').update(target_device_id, {
      content_version: contentVersion,
    });
    return NextResponse.json({ data: { id: updated.id, content_version: updated.content_version } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
