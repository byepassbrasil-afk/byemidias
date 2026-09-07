import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// POST /api/dashboard/media/[id]/extend-expiration
// Body: { days: number } - days from NOW. If days=0 or null, removes expiration (permanent).
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

    let newExpiresAt: string | null = null;
    if (days > 0) {
      const [result] = await sql`
        UPDATE media
        SET expires_at = NOW() + (${days} || ' days')::interval,
            status = 'active',
            expires_reason = COALESCE(expires_reason, '') || ' [prorrogada]'
        WHERE id = ${id}
        RETURNING expires_at
      `;
      newExpiresAt = result?.expires_at || null;
    } else {
      // Permanente
      await sql`
        UPDATE media
        SET expires_at = NULL,
            expires_reason = 'permanente',
            status = 'active'
        WHERE id = ${id}
      `;
      newExpiresAt = null;
    }

    return NextResponse.json({ success: true, expires_at: newExpiresAt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[extend-expiration]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
