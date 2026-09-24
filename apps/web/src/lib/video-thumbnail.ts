/**
 * Extract a thumbnail (JPEG blob) from a video File in the browser.
 * Captures the first non-black frame within the first few seconds.
 * Uses HTMLVideoElement + HTMLCanvasElement — no ffmpeg required.
 */
export async function extractVideoThumbnail(file: File, maxWidth = 480): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;
  if (!file.type.startsWith('video/')) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = url;
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.top = '0';
  document.body.appendChild(video);

  const cleanup = () => {
    try { document.body.removeChild(video); } catch {}
    try { URL.revokeObjectURL(url); } catch {}
  };

  const seekTo = (seconds: number): Promise<void> => new Promise((resolve, reject) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    const onError = () => { video.removeEventListener('error', onError); reject(new Error('seek error')); };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try { video.currentTime = Math.max(0, seconds); } catch (e) { reject(e); }
  });

  const captureFrame = async (): Promise<Blob | null> => {
    try {
      const w0 = video.videoWidth;
      const h0 = video.videoHeight;
      if (!w0 || !h0) return null;
      const ratio = w0 / h0;
      const targetW = Math.min(maxWidth, w0);
      const targetH = Math.round(targetW / ratio);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const blob: Blob | null = await new Promise(resolve => {
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.78);
      });
      return blob;
    } catch { return null; }
  };

  try {
    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= 1) resolve();
      else {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('metadata error')), { once: true });
      }
    });

    // Try seeking to several points and grab first successful frame
    const seekPoints = [0.1, 1.0, 2.0, 3.0, 5.0];
    for (const t of seekPoints) {
      if (t > video.duration) break;
      try {
        await seekTo(t);
        const blob = await captureFrame();
        if (blob && blob.size > 1024) {
          cleanup();
          return blob;
        }
      } catch {}
    }
    cleanup();
    return null;
  } catch (e) {
    cleanup();
    return null;
  }
}

/**
 * Upload a thumbnail Blob to R2 using the same presigned proxy endpoint.
 * Returns the public URL of the uploaded thumbnail.
 */
export async function uploadThumbnail(blob: Blob, organizationId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Get presigned URL for the thumbnail
  const filename = `thumb-${Date.now()}.jpg`;
  const presignRes = await fetch('/api/admin/media/upload-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Filename': filename,
      'X-Organization-Id': organizationId,
    },
  });
  if (!presignRes.ok) return null;
  const presignData = await presignRes.json();

  // Upload to R2
  const uploadRes = await fetch(presignData.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!uploadRes.ok) return null;

  return presignData.public_url;
}
