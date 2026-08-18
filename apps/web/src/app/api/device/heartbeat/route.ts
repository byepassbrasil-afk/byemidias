import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/device/heartbeat - Send device heartbeat
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const { device_id, status, player_version, storage_available, current_content, current_playlist, error_message } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    }

    // Update device heartbeat
    const { error } = await supabase
      .from('devices')
      .update({
        last_heartbeat: new Date().toISOString(),
        status: status || 'active',
        player_version: player_version || null,
        storage_available: storage_available || null,
      })
      .eq('id', device_id);

    if (error) {
      console.error('Heartbeat update error:', error);
    }

    // Log heartbeat if there's an error
    if (error_message) {
      console.error(`Device ${device_id} error: ${error_message}`);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('POST /api/device/heartbeat error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
