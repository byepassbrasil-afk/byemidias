'use client';

import { useEffect, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
}

export default function VideoThumbnail(props: VideoThumbnailProps) {
  const src = props.src;
  const alt = props.alt || '';
  const className = props.className || '';

  const [thumb, setThumb] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Tenta cache local
    try {
      const cached = sessionStorage.getItem('vt_' + src);
      const cachedTs = sessionStorage.getItem('vtt_' + src);
      const ageMs = cachedTs ? Date.now() - Number(cachedTs) : Infinity;
      if (cached && ageMs < 24 * 60 * 60 * 1000) {
        setThumb(cached);
        setTried(true);
        return;
      }
    } catch (_) {}

    if (!src || src.indexOf('data:') === 0) {
      setTried(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    // Usa proxy server-side (bypassa CORS do R2)
    const proxyUrl = '/api/thumbnail?url=' + encodeURIComponent(src);

    fetch(proxyUrl, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        if (cancelled) return;
        const dataUrl: string = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = function () { resolve(reader.result as string); };
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;
        setThumb(dataUrl);
        setTried(true);
        try {
          sessionStorage.setItem('vt_' + src, dataUrl);
          sessionStorage.setItem('vtt_' + src, String(Date.now()));
        } catch (_) {}
      })
      .catch(() => {
        if (!cancelled) setTried(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src]);

  if (thumb) {
    return <img src={thumb} alt={alt} className={className} loading="lazy" />;
  }
  return (
    <div className={'flex items-center justify-center text-4xl ' + className}>
      🎬
    </div>
  );
}
