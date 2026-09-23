import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Hello from /api/test!',
    timestamp: new Date().toISOString(),
    url: process.env.PB_URL || 'not set',
    envCount: Object.keys(process.env).filter(k => k.startsWith('PB') || k.startsWith('DATABASE')).length,
  });
}
