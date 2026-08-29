import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { listObjects } from '@/lib/r2';

export async function GET(request: NextRequest) {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const prefix = new URL(request.url).searchParams.get('prefix') ?? '';
  try {
    const result = await listObjects(prefix);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Storage list error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
