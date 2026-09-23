import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// GET /api/dashboard/devices/all-categories?ids=uuid1,uuid2,... 
// Returns assignments: { device_id: [{ category_id, is_blocked }] }
export async function GET(request: NextRequest) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';
    const ids = idsParam.split(',').filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ assignments: {} });
    }

    const rows = await sql`
      SELECT device_id, category_id, is_blocked
      FROM device_categories
      WHERE device_id = ANY(${ids})
    `;

    const assignments: Record<string, { category_id: string; is_blocked: boolean }[]> = {};
    for (const r of rows) {
      if (!assignments[r.device_id]) assignments[r.device_id] = [];
      assignments[r.device_id].push({ category_id: r.category_id, is_blocked: r.is_blocked });
    }

    return NextResponse.json({ assignments });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

