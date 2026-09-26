import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deviceId = body.device_id;
    if (!deviceId) return NextResponse.json({ error: 'device_id obrigatório' }, { status: 400 });
    const pb = await getAdminClient();
    const collection = await pb.collections.getOne('devices');
    const existingFields = collection.fields || collection.schema || [];
    const fields = [
      { name: 'video_volume', type: 'number' },
      { name: 'api_base_url', type: 'text' },
      { name: 'video_player', type: 'text' },
      { name: 'html_render', type: 'text' },
      { name: 'image_fit_mode', type: 'text' },
      { name: 'image_rotation_lock', type: 'number' },
      { name: 'auto_update', type: 'bool' },
      { name: 'low_mem_restart', type: 'bool' },
    ];
    const missing = fields.filter((f) => !existingFields.some((s: any) => s.name === f.name));
    if (missing.length > 0) await pb.collections.update('devices', { fields: [...existingFields, ...missing] });
    const allowed = ['video_volume', 'api_base_url', 'video_player', 'html_render', 'image_fit_mode', 'image_rotation_lock', 'auto_update', 'low_mem_restart'];
    const updates: any = {};
    for (const key of allowed) if (body[key] !== undefined) updates[key] = body[key];
    const device = await pb.collection('devices').update(deviceId, updates);
    return NextResponse.json({ success: true, device });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao salvar configuração' }, { status: 500 });
  }
}
