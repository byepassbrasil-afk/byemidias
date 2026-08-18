'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface MediaItem {
  id: string;
  name: string;
  type: string;
  file_url: string;
  duration: number | null;
  localPath?: string;
}

interface Playlist {
  id: string;
  name: string;
  items: { media_id: string; position: number; duration: number | null; slot_id: string | null }[];
}

interface Campaign {
  id: string;
  name: string;
  playlist_id: string;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[];
}

export default function PlayerPage() {
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [status, setStatus] = useState('Inicializando...');
  const [deviceInfo, setDeviceInfo] = useState<{ id: string; uuid: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || '';

  const fetchJson = useCallback(async (url: string) => {
    const res = await fetch(url);
    return res.json();
  }, []);

  const getDeviceId = useCallback(() => {
    let uuid = localStorage.getItem('device_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('device_uuid', uuid);
    }
    return uuid;
  }, []);

  const activateDevice = useCallback(async (code: string) => {
    const uuid = getDeviceId();
    const res = await fetch(`${API_BASE}/api/device/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_uuid: uuid,
        activation_code: code,
        model: navigator.userAgent,
        manufacturer: 'PWA',
        os_version: navigator.platform,
        player_version: '1.0.0-pwa',
        resolution: `${screen.width}x${screen.height}`,
      }),
    });
    const data = await res.json();
    if (data.device_id) {
      localStorage.setItem('device_id', data.device_id);
      setDeviceInfo({ id: data.device_id, uuid });
      return true;
    }
    return false;
  }, [getDeviceId, API_BASE]);

  const syncContent = useCallback(async (deviceId: string) => {
    const data = await fetchJson(`${API_BASE}/api/device/sync?device_id=${deviceId}&content_version=0`);
    return data;
  }, [fetchJson, API_BASE]);

  const sendHeartbeat = useCallback(async (deviceId: string) => {
    await fetch(`${API_BASE}/api/device/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        status: 'active',
        player_version: '1.0.0-pwa',
      }),
    });
  }, [API_BASE]);

  const playMedia = useCallback((media: MediaItem, duration: number) => {
    setCurrentMedia(media);
    setIsVideo(media.type === 'video');

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (media.type !== 'video') {
      timeoutRef.current = setTimeout(() => {
        setCurrentMedia(null);
      }, (duration || 10) * 1000);
    }
  }, []);

  const startPlayback = useCallback(async (deviceId: string) => {
    setStatus('Carregando conteúdo...');
    const syncData = await syncContent(deviceId);

    if (!syncData?.playlists?.length) {
      setStatus('Nenhum conteúdo disponível');
      setTimeout(() => startPlayback(deviceId), 30000);
      return;
    }

    const playlist = syncData.playlists[0] as Playlist;
    const mediaList = syncData.media as MediaItem[];

    setStatus(`Reproduzindo: ${playlist.name}`);

    let itemIndex = 0;

    const playNext = () => {
      if (itemIndex >= playlist.items.length) itemIndex = 0;

      const item = playlist.items.sort((a, b) => a.position - b.position)[itemIndex];
      const media = mediaList.find((m) => m.id === item.media_id);

      if (media) {
        playMedia(media, item.duration || 10);
      }

      itemIndex++;
    };

    playNext();

    // Loop
    setInterval(() => {
      playNext();
    }, 15000);
  }, [syncContent, playMedia]);

  useEffect(() => {
    const init = async () => {
      const deviceId = localStorage.getItem('device_id');

      if (!deviceId) {
        // Show activation screen - for now use a demo code
        setStatus('Aguardando ativação...');
        // Auto-activate with demo for testing
        const success = await activateDevice('DEMO0001');
        if (success) {
          const id = localStorage.getItem('device_id');
          if (id) startPlayback(id);
        }
      } else {
        setDeviceInfo({ id: deviceId, uuid: getDeviceId() });
        startPlayback(deviceId);

        // Heartbeat every 30s
        setInterval(() => sendHeartbeat(deviceId), 30000);
      }
    };

    init();
  }, [activateDevice, startPlayback, sendHeartbeat, getDeviceId]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* Activation overlay */}
      {!deviceInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-white">ByeMidias</h1>
            <p className="text-gray-400">{status}</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Código de ativação"
                className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white text-center text-lg tracking-widest w-64"
                maxLength={8}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const code = (e.target as HTMLInputElement).value;
                    if (code.length === 8) {
                      setStatus('Ativando...');
                      const success = await activateDevice(code);
                      if (!success) {
                        setStatus('Código inválido');
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Media display */}
      {currentMedia && (
        <>
          {isVideo ? (
            <video
              ref={videoRef}
              src={currentMedia.file_url}
              className="w-full h-full object-contain"
              autoPlay
              onEnded={() => setCurrentMedia(null)}
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

      {/* Fallback when no media */}
      {!currentMedia && deviceInfo && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">ByeMidias</h1>
            <p className="text-gray-500">{status}</p>
          </div>
        </div>
      )}

      {/* Status bar (hidden by default, show on click) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{status}</span>
          <span>{currentMedia?.name || '—'}</span>
        </div>
      </div>
    </div>
  );
}
