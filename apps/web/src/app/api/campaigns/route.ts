import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const data = await sql`SELECT * FROM campaigns WHERE is_active = true ORDER BY name`;
    return NextResponse.json({ campaigns: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
