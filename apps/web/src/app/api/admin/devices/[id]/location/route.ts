import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// PATCH /api/admin/devices/[id]/location — Update lat/lng/address
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { latitude, longitude, address, city, state } = body;

    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'latitude e longitude obrigatórios' }, { status: 400 });
    }

    if (user.role !== 'super_admin') {
      const [own] = await sql`SELECT organization_id FROM devices WHERE id = ${id}`;
      if (!own || own.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    const [updated] = await sql`
      UPDATE devices SET
        latitude = ${Number(latitude)},
        longitude = ${Number(longitude)},
        address = ${address || null},
        city = ${city || null},
        state = ${state || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, latitude, longitude, address, city, state
    `;

    if (!updated) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ device: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
