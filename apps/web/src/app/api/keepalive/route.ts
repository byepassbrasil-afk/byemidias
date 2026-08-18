import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/keepalive - Prevent Supabase hibernation
// Supabase free tier hibernates after 7 days of inactivity
// This endpoint queries the DB to keep it alive
// Call this every 3-5 days via external cron
export async function GET() {
  try {
    const supabase = getServiceClient();
    const startTime = Date.now();

    // Run a simple query to keep the DB active
    const { count, error } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true });

    // Also touch the keepalive_log table
    await supabase.from('keepalive_log').insert({
      checked_at: new Date().toISOString(),
      device_count: count || 0,
      response_ms: Date.now() - startTime,
    });

    // Cleanup old logs (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await supabase
      .from('keepalive_log')
      .delete()
      .lt('checked_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      device_count: count || 0,
      response_ms: Date.now() - startTime,
      message: 'Supabase keepalive ping successful',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('GET /api/keepalive error:', msg);
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
  }
}
