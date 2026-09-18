'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Gera thumbnail do vídeo carregando o primeiro frame.
 * - Mostra 🎬 imediatamente (não bloqueia UI)
 * - preload="none" para não consumir banda antes de necessário
 * - Cache do data URL em localStorage (24h) para não reprocessar
 */
export default function VideoThumbnail({ src, alt = '', className = '' }: VideoThumbnailProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cacheKey = `vidthumb:${src}`;
  const cacheTsKey = `vidthumb_ts:${src}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Tenta cache (válido por 24h)
    try {
      const cached = localStorage.getItem(cacheKey);
      const cachedTs = localStorage.getItem(cacheTsKey);
      const ageMs = cachedTs ? Date.now() - Number(cachedTs) : Infinity;
      if (cached && ageMs < 24 * 60 * 60 * 1000) {
        setThumb(cached);
        setTried(true);
        return;
      }
    } catch {}

    // Skip se o src for R2 do supabase (gera logs de erro de CORS)
    if (!src || src.startsWith('data:')) {
      setTried(true);
      return;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    // Não baixa o vídeo inteiro — só os primeiros bytes pra pegar o frame
    video.preload = 'metadata';

    // Timeout agressivo: se demorar mais que 4s, desiste
    let timeoutId: any = setTimeout(() => {
      try { video.src = ''; } catch {}
      setTried(true);
    }, 4000);

    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      try { video.src = ''; } catch {}
    };

    const onLoaded = () => {
      if (cancelled) return;
      try {
        // Pula para ~0.5s ou meio (o que for menor) pra evitar frame preto inicial
        const dur = isFinite(video.duration) ? video.duration : 2;
        video.currentTime = Math.min(0.5, dur / 2);
      } catch {}
    };

    const onSeeked = () => {
      if (cancelled) return;
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        const canvas = document.createElement('canvas');
        const targetW = 240;  // menor = mais rápido
        const scale = targetW / w;
        canvas.width = targetW;
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { setTried(true); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);  // qualidade menor = mais rápido
        setThumb(dataUrl);
        setTried(true);
        try {
          localStorage.setItem(cacheKey, dataUrl);
          localStorage.setItem(cacheTsKey, String(Date.now()));
        } catch {}
      } catch {
        setTried(true);
      } finally {
        cleanup();
      }
    };

    const onError = () => {
      if (cancelled) return;
      setTried(true);
      cleanup();
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    try {
      video.src = src;
    } catch {
      setTried(true);
      cleanup();
    }

    return cleanup;
  }, [src, cacheKey, cacheTsKey]);

  if (thumb) {
    return <img src={thumb} alt={alt} className={className} loading="lazy" />;
  }
  // Enquanto processa OU falhou → mostra 🎬 (placeholder instantâneo)
  return (
    <div className={`flex items-center justify-center text-4xl ${className}`}>
      🎬
    </div>
  );
}

