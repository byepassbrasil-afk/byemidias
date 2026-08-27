import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner-auth';

export async function GET() {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    return NextResponse.json({ partner: session });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
