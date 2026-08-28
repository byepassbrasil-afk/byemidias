import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

// GET /api/admin/partner-media — List pending partner media uploads
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let uploads;
    if (user.role === 'super_admin') {
      uploads = await sql`
        SELECT pmu.*, pa.username as partner_username, pa.display_name as partner_name,
               m.name as media_name, m.type as media_type, m.file_url, m.file_size
        FROM partner_media_uploads pmu
        LEFT JOIN partner_access pa ON pa.id = pmu.partner_access_id
        LEFT JOIN media m ON m.id = pmu.media_id
        WHERE pmu.status = ${status}
        ORDER BY pmu.created_at DESC
      `;
    } else {
      uploads = await sql`
        SELECT pmu.*, pa.username as partner_username, pa.display_name as partner_name,
               m.name as media_name, m.type as media_type, m.file_url, m.file_size
        FROM partner_media_uploads pmu
        LEFT JOIN partner_access pa ON pa.id = pmu.partner_access_id
        LEFT JOIN media m ON m.id = pmu.media_id
        WHERE pmu.organization_id = ${user.organization_id} AND pmu.status = ${status}
        ORDER BY pmu.created_at DESC
      `;
    }

    return NextResponse.json({ uploads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/partner-media — Approve/reject partner media
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Verify upload belongs to user's org (unless super_admin)
    if (user.role !== 'super_admin') {
      const [upload] = await sql`SELECT organization_id FROM partner_media_uploads WHERE id = ${id}`;
      if (!upload || upload.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
      }
    }

    await sql`UPDATE partner_media_uploads SET status = ${status} WHERE id = ${id}`;

    // If approved, ensure media record is active
    if (status === 'approved') {
      const [upload] = await sql`SELECT media_id FROM partner_media_uploads WHERE id = ${id}`;
      if (upload?.media_id) {
        await sql`UPDATE media SET status = 'active' WHERE id = ${upload.media_id}`;
      }
    }

    // Bump content_version so devices pick up the change
    if (user.organization_id) {
      bumpContentVersion(user.organization_id).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
