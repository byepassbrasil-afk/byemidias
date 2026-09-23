import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET() {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ data: [] });

    const pb = await getAdminClient();
    const isSuperAdmin = user.role === 'super_admin';

    const filter = isSuperAdmin ? undefined : `organization_id = "${user.organization_id}"`;
    const devices = await pb.collection('devices').getList(1, 500, {
      filter,
      sort: '-id',
    });

    return NextResponse.json({ data: devices.items ?? [] });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[devices/all]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
