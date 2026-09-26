import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const pb = await getAdminClient();
    const filter = user.role === 'super_admin' ? '' : `organization_id = "${user.organization_id}"`;
    const codes = await pb.collection('activation_codes').getList(1, 500, {
      filter,
      sort: '-id',
    });

    const result = [];
    for (const code of codes.items) {
      const device = code.linked_device_id
        ? await pb.collection('devices').getOne(code.linked_device_id).catch(() => null)
        : null;
      result.push({
        ...code,
        created_at: code.created_at || code.created,
        use_count: code.use_count || 0,
        max_uses: code.max_uses || 1,
        device: device ? { id: device.id, name: device.name, status: device.status } : null,
      });
    }
    return NextResponse.json({ codes: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[activation-codes GET] erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { count = 1, organization_id, expires_at } = body;

    const orgId = organization_id || user.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'organization_id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();
    const insertedCodes = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      const data: any = {
        code: generateCode(),
        organization_id: orgId,
        max_uses: 1,
        use_count: 0,
        status: 'active',
      };

      if (expires_at) data.expires_at = expires_at;

      const record = await pb.collection('activation_codes').create(data);
      insertedCodes.push(record);
    }

    return NextResponse.json({ codes: insertedCodes });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[activation-codes POST] erro:', msg, e.data);
    return NextResponse.json({ error: msg, data: e.data }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const pb = await getAdminClient();

    // Verificar se o código pertence à org do user (se não for super_admin)
    if (user.role !== 'super_admin') {
      const code = await pb.collection('activation_codes').getOne(codeId);
      if (code.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    await pb.collection('activation_codes').delete(codeId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[activation-codes DELETE] erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
