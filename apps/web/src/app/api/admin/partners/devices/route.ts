import { NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(request: Request) {
  try {
    const user = await requireAuthApi();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await sql`SELECT organization_id, role FROM profiles WHERE id = ${user.id}`;

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { partner_id, devices } = await request.json();

    if (!partner_id || !Array.isArray(devices)) {
      return NextResponse.json({ error: 'partner_id e devices obrigatórios' }, { status: 400 });
    }

    let partner;
    if (profile.role !== 'super_admin' && profile.organization_id) {
      [partner] = await sql`SELECT id FROM partner_access WHERE id = ${partner_id} AND organization_id = ${profile.organization_id}`;
    } else {
      [partner] = await sql`SELECT id FROM partner_access WHERE id = ${partner_id}`;
    }

    if (!partner) {
      return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    await sql`DELETE FROM partner_devices WHERE partner_access_id = ${partner_id}`;

    if (devices.length > 0) {
      for (const d of devices) {
        await sql`INSERT INTO partner_devices (partner_access_id, device_id, playlist_id) VALUES (${partner_id}, ${d.device_id}, ${d.playlist_id || null})`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('PUT /api/admin/partners/devices error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
