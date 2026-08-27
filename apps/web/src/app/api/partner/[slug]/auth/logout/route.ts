import { NextResponse } from 'next/server';
import { clearPartnerSessionCookie } from '@/lib/partner-auth';

export async function POST() {
  try {
    await clearPartnerSessionCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
