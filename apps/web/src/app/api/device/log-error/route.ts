import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, event_type, severity, message, details, media_id, media_url, campaign_id, playlist_id } = body;
    if (!device_id || !event_type || !message) return NextResponse.json({ error: 'device_id, event_type e message são obrigatórios' }, { status: 400 });
    const pb = await getAdminClient();
    const device = await pb.collection('devices').getOne(device_id);
    await pb.collection('device_logs').create({
      device_id,
      organization_id: device.organization_id,
      event_type,
      severity: severity || 'info',
      message,
      details: details || null,
      media_id: media_id || null,
      media_url: media_url || null,
      campaign_id: campaign_id || null,
      playlist_id: playlist_id || null,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao registrar log' }, { status: 500 });
  }
}
