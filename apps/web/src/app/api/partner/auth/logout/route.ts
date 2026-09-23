import { NextResponse } from 'next/server';
import { clearPartnerSessionCookie } from '@/lib/partner-auth';

export const dynamic = 'force-dynamic';


export async function POST() {
  await clearPartnerSessionCookie();
  return NextResponse.json({ success: true });
}
