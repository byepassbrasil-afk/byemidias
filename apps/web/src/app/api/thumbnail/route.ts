import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url obrigatório' }, { status: 400 });
  }

  // Try using ffmpeg to extract a frame at 1s
  try {
    const result = await new Promise<{ success: boolean; data?: Buffer; error?: string }>((resolve) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-ss', '1',
        '-i', url,
        '-vframes', '1',
        '-vf', 'scale=240:-1',
        '-q:v', '5',
        '-f', 'image2',
        '-c:v', 'mjpeg',
        'pipe:1'
      ], { timeout: 20000 });

      const chunks: Buffer[] = [];
      let stderr = '';

      proc.stdout.on('data', (chunk) => chunks.push(chunk));
      proc.stderr.on('data', (chunk) => stderr += chunk.toString());

      proc.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve({ success: true, data: Buffer.concat(chunks) });
        } else {
          resolve({ success: false, error: stderr.slice(-200) });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });

    if (result.success && result.data) {
      return new NextResponse(new Uint8Array(result.data), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      });
    }

    return NextResponse.json({
      error: 'Falha ao extrair frame',
      details: result.error,
    }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
