import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ campaigns: [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
