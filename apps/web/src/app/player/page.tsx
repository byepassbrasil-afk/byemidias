'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface MediaItem {
  id: string;
  name: string;
  type: string;
  file_url: string;
  duration: number | null;
}

export default function PlayerPage() {
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [status, setStatus] = useState('Inicializando...');
  const [activated, setActivated] = useState(false);
  const [activationError, setActivationError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const playlistQueueRef = useRef<{ items: { media_id: string; position: number; duration: number | null }[]; mediaList: MediaItem[] }[]>([]);
  const playlistIndexRef = useRef(0);
  const itemIndexRef = useRef(0);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentVersionRef = useRef(0);

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const getDeviceId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('device_id') || localStorage.getItem('device_id');
  };

  const getDeviceUuid = () => localStorage.getItem('device_uuid');

  const activateDevice = useCallback(async (code: string) => {
    let uuid = getDeviceUuid();
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('device_uuid', uuid);
    }

    setActivationError('');
    setStatus('Ativando...');

    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/device/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_uuid: uuid,
          activation_code: code.toUpperCase().trim(),
          model: navigator.userAgent,
          manufacturer: 'PWA',
          os_version: navigator.platform,
          player_version: '1.0.0-pwa',
          resolution: `${screen.width}x${screen.height}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.device_id) {
        localStorage.setItem('device_id', data.device_id);
        setActivated(true);
        return data.device_id;
      } else {
        setActivationError(data.error || 'Código inválido');
        setStatus('Aguardando ativação...');
        return null;
      }
    } catch {
      setActivationError('Erro de conexão.');
      setStatus('Aguardando ativação...');
      return null;
    }
  }, []);

  const sendHeartbeat = useCallback(async (deviceId: string) => {
    try {
      const base = getBaseUrl();
      await fetch(`${base}/api/device/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          status: 'online',
          player_version: '1.0.0-pwa',
          uptime_seconds: Math.floor((Date.now() - Number((window as unknown as Record<string, string>).__sessionStart || Date.now())) / 1000),
        }),
      });
    } catch { /* ignore */ }
  }, []);

  const playNext = useCallback(() => {
    if (abortRef.current || playlistQueueRef.current.length === 0) return;

    const queue = playlistQueueRef.current;
    const plIndex = playlistIndexRef.current;

    if (plIndex >= queue.length) {
      playlistIndexRef.current = 0;
      itemIndexRef.current = 0;
      playNext();
      return;
    }

    const { items, mediaList } = queue[plIndex];

    if (itemIndexRef.current >= items.length) {
      playlistIndexRef.current++;
      itemIndexRef.current = 0;
      playNext();
      return;
    }

    const item = items[itemIndexRef.current];
    const media = mediaList.find((m) => m.id === item.media_id);

    if (!media) {
      itemIndexRef.current++;
      playNext();
      return;
    }

    const duration = item.duration || 10;

    setCurrentMedia(media);
    setIsVideo(media.type === 'video');

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    advanceTimerRef.current = setTimeout(() => {
      itemIndexRef.current++;
      playNext();
    }, duration * 1000);
  }, []);

  const handleVideoEnded = useCallback(() => {
    itemIndexRef.current++;
    playNext();
  }, [playNext]);

  const handleVideoError = useCallback(() => {
    itemIndexRef.current++;
    playNext();
  }, [playNext]);

  const startPlayback = useCallback(async (deviceId: string) => {
    setStatus('Carregando conteúdo...');

    try {
      const base = getBaseUrl();
      const params = new URLSearchParams(window.location.search);
      const campaignId = params.get('campaign_id');

      let url = `${base}/api/device/sync?device_id=${deviceId}&content_version=${contentVersionRef.current}`;
      if (campaignId) {
        url += `&campaign_id=${campaignId}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setStatus(`Erro: ${data.error}`);
        setTimeout(() => { if (!abortRef.current) startPlayback(deviceId); }, 30000);
        return;
      }

      if (!data.playlists?.length) {
        setStatus('Nenhum conteúdo atribuído. Configure no painel admin.');
        setTimeout(() => { if (!abortRef.current) startPlayback(deviceId); }, 30000);
        return;
      }

      const mediaList = data.media as MediaItem[];
      contentVersionRef.current = data.content_version || 0;

      const queue = data.playlists.map((pl: { items: { media_id: string; position: number; duration: number | null }[]; name: string }) => ({
        name: pl.name,
        items: [...pl.items].sort((a: { position: number }, b: { position: number }) => a.position - b.position),
        mediaList,
      }));

      setStatus(`Reproduzindo: ${queue.length} playlist(s)`);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const urls = mediaList.map((m) => m.file_url).filter(Boolean);
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_MEDIA', urls });
      }

      playlistQueueRef.current = queue;
      playlistIndexRef.current = 0;
      itemIndexRef.current = 0;

      playNext();
    } catch {
      setStatus('Sem conexão. Tentando novamente...');
      setTimeout(() => { if (!abortRef.current) startPlayback(deviceId); }, 15000);
    }
  }, [playNext]);

  const checkForUpdates = useCallback(async (deviceId: string) => {
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/device/sync?device_id=${deviceId}&content_version=${contentVersionRef.current}`);
      const data = await res.json();

      if (data.content_version && data.content_version > contentVersionRef.current) {
        contentVersionRef.current = data.content_version;
        startPlayback(deviceId);
      }
    } catch { /* ignore */ }
  }, [startPlayback]);

  useEffect(() => {
    (window as unknown as Record<string, string>).__sessionStart = String(Date.now());
    abortRef.current = false;
    const deviceId = getDeviceId();
    if (deviceId) {
      setActivated(true);
      startPlayback(deviceId);
    } else {
      setStatus('Aguardando ativação...');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      abortRef.current = true;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [startPlayback]);

  useEffect(() => {
    if (!activated) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;
    const hb = setInterval(() => {
      sendHeartbeat(deviceId);
      checkForUpdates(deviceId);
    }, 30000);
    return () => clearInterval(hb);
  }, [activated, sendHeartbeat, checkForUpdates]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {!activated && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-white">ByeMidias</h1>
            <p className="text-gray-400">{status}</p>
            {activationError && <p className="text-red-400 text-sm">{activationError}</p>}
            <div className="flex flex-col items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Digite o código de ativação"
                className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white text-center text-lg tracking-widest w-64 focus:outline-none focus:border-blue-500"
                maxLength={8}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const code = (e.target as HTMLInputElement).value.trim();
                    if (code.length >= 6) {
                      const id = await activateDevice(code);
                      if (id) startPlayback(id);
                    }
                  }
                }}
              />
              <button
                onClick={async () => {
                  const code = inputRef.current?.value.trim() || '';
                  if (code.length >= 6) {
                    const id = await activateDevice(code);
                    if (id) startPlayback(id);
                  }
                }}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700"
              >
                Ativar
              </button>
            </div>
          </div>
        </div>
      )}

      {currentMedia && (
        <>
          {isVideo ? (
            <video
              ref={videoRef}
              key={currentMedia.id}
              src={currentMedia.file_url}
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              onError={handleVideoError}
            />
          ) : (
            <img
              src={currentMedia.file_url}
              alt={currentMedia.name}
              className="w-full h-full object-contain"
            />
          )}
        </>
      )}

      {!currentMedia && activated && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">ByeMidias</h1>
            <p className="text-gray-500">{status}</p>
          </div>
        </div>
      )}
    </div>
  );
}
