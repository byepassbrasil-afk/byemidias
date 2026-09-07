import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// POST /api/dashboard/media/[id]/reactivate
// Body: { days: number }
// Reativa uma mídia expirada: define nova data de expiração = NOW + days, status='active'.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const days = body.days ?? 7;

    const [media] = await sql`SELECT organization_id FROM media WHERE id = ${id}`;
    if (!media) return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 });
    if (user.role !== 'super_admin' && media.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Reativa com nova data
    const [result] = await sql`
      UPDATE media
      SET expires_at = NOW() + (${days} || ' days')::interval,
          status = 'active',
          expires_reason = 'reativada manualmente'
      WHERE id = ${id}
      RETURNING expires_at
    `;
    const newExpiresAt = result?.expires_at || null;

    return NextResponse.json({ success: true, expires_at: newExpiresAt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[reactivate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
