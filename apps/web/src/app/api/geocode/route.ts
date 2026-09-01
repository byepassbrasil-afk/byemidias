import { NextRequest, NextResponse } from 'next/server';

// GET /api/geocode?q=endereço — Proxy for Nominatim (OSM) geocoding
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q || q.trim().length < 3) {
      return NextResponse.json({ error: 'q obrigatório (mín 3 chars)' }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ByeMidias/1.0 (https://byemidias.vercel.app)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha no geocoding' }, { status: 502 });
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Endereço não encontrado' }, { status: 404 });
    }

    const hit = data[0];
    return NextResponse.json({
      latitude: parseFloat(hit.lat),
      longitude: parseFloat(hit.lon),
      display_name: hit.display_name,
      type: hit.type,
      importance: hit.importance,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
