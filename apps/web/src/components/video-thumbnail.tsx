'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Gera thumbnail do vídeo carregando o primeiro frame.
 * Faz cache do data URL em sessionStorage para não reprocessar.
 */
export default function VideoThumbnail({ src, alt = '', className = '' }: VideoThumbnailProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cacheKey = `vidthumb:${src}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Tenta cache
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setThumb(cached);
        setTried(true);
        return;
      }
    } catch {}

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = src;
    videoRef.current = video;

    let cancelled = false;
    const onLoaded = () => {
      if (cancelled) return;
      try {
        // Pula para 1s (ou meio do vídeo, o que for menor) para evitar frame preto inicial
        const t = Math.min(1, (video.duration || 2) / 2);
        video.currentTime = t;
      } catch {
        // ignore
      }
    };
    const onSeeked = () => {
      if (cancelled) return;
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        const canvas = document.createElement('canvas');
        // Mantém aspect ratio com largura fixa para economia
        const targetW = 320;
        const scale = targetW / w;
        canvas.width = targetW;
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setThumb(dataUrl);
        setTried(true);
        try { sessionStorage.setItem(cacheKey, dataUrl); } catch {}
      } catch (e) {
        console.warn('VideoThumbnail error', e);
      }
    };
    const onError = () => {
      if (cancelled) return;
      setTried(true);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
    };
  }, [src, cacheKey]);

  if (thumb) {
    return <img src={thumb} alt={alt} className={className} loading="lazy" />;
  }
  if (tried) {
    return (
      <div className={`flex items-center justify-center text-4xl ${className}`}>
        🎬
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center text-4xl animate-pulse ${className}`}>
      🎬
    </div>
  );
}
