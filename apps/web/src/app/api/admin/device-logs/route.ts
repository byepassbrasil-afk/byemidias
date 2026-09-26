import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const pb = await getAdminClient();
    const filters: string[] = [];
    if (deviceId) filters.push(`device_id = "${deviceId}"`);
    if (user.role !== 'super_admin' && user.organization_id) filters.push(`organization_id = "${user.organization_id}"`);
    const result = await pb.collection('device_logs').getList(1, limit, {
      filter: filters.join(' && ') || undefined,
    });
    return NextResponse.json({ data: result.items || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao buscar logs' }, { status: 500 });
  }
}
