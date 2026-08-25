import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

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

    // Bump content_version directly
    const result = await sql`UPDATE devices SET content_version = (EXTRACT(EPOCH FROM NOW())::bigint % 100000), updated_at = NOW() WHERE id = ${target_device_id} RETURNING content_version`;

    return NextResponse.json({ data: result[0] || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
