'use client';

import { useEffect, useRef, useState } from 'react';

export interface PreviewZone {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'campaign' | 'mask' | 'logo' | 'clock' | 'weather' | 'text';
  content?: string;
  config?: Record<string, string | number | undefined>;
}

export interface PreviewMedia {
  id: string;
  name?: string;
  type: string;
  file_url: string;
  duration?: number;
}

export interface PreviewPlaylistItem {
  id: string;
  media_id: string;
  slot_id?: string | null;
  duration?: number;
}

export interface PreviewSlot {
  id: string;
  slot_order: number;
  partner_name?: string;
  partner_username?: string;
  content_duration: number;
  has_content: boolean;
}

export interface PreviewPlaylist {
  id: string;
  name: string;
  position: number;
  items: PreviewPlaylistItem[];
  slots: PreviewSlot[];
}

export interface PreviewData {
  campaign?: { id: string; name: string };
  layout?: { id: string; name?: string; width: number; height: number; zones: PreviewZone[] };
  playlists: PreviewPlaylist[];
  media: PreviewMedia[];
}

interface PlayerPreviewProps {
  data: PreviewData;
  width?: number;  // visual width in px
  height?: number; // visual height in px
  onClose?: () => void;
  showCloseButton?: boolean;
}

interface FlatItem {
  id: string;
  media: PreviewMedia;
  duration: number;
  source: 'playlist' | 'slot';
  slotId?: string;
  slotPartnerName?: string;
}

const ZONE_COLORS: Record<string, string> = {
  campaign: '#1e40af',
  mask: '#6b21a8',
  logo: '#a16207',
  clock: '#15803d',
  weather: '#0e7490',
  text: '#374151',
};

export function PlayerPreview({ data, width = 960, height = 540, onClose, showCloseButton = true }: PlayerPreviewProps) {
  const layoutWidth = data.layout?.width || 1920;
  const layoutHeight = data.layout?.height || 1080;
  const zones = data.layout?.zones || [];

  // Build a flat playlist (interleaving slot content with regular media)
  const flatItems: FlatItem[] = (() => {
    const items: FlatItem[] = [];
    for (const playlist of data.playlists) {
      const regularById = new Map<string, FlatItem>();
      const mediaBySlot = new Map<string, FlatItem[]>();

      for (const item of playlist.items) {
        const media = data.media.find(m => m.id === item.media_id);
        if (!media) continue;
        const duration = Math.max(item.duration || media.duration || 10, 3);
        const flat: FlatItem = {
          id: item.id,
          media,
          duration,
          source: item.slot_id ? 'slot' : 'playlist',
          slotId: item.slot_id || undefined,
        };
        if (item.slot_id) {
          const arr = mediaBySlot.get(item.slot_id) || [];
          arr.push(flat);
          mediaBySlot.set(item.slot_id, arr);
        } else {
          regularById.set(media.id, flat);
        }
      }

      const ordered: FlatItem[] = [];
      const allFlat = Array.from(regularById.values());
      let regIdx = 0;
      const totalSlots = playlist.slots.length;
      const maxPos = allFlat.length + totalSlots;
      for (let pos = 0; pos < maxPos; pos++) {
        const slotAtPos = playlist.slots.find(s => s.slot_order === pos);
        if (slotAtPos) {
          const slotContent = mediaBySlot.get(slotAtPos.id) || [];
          if (slotContent.length > 0) {
            slotContent[0].slotPartnerName = slotAtPos.partner_name;
            ordered.push(...slotContent);
          }
        } else if (regIdx < allFlat.length) {
          ordered.push(allFlat[regIdx]);
          regIdx++;
        }
      }
      while (regIdx < allFlat.length) {
        ordered.push(allFlat[regIdx]);
        regIdx++;
      }
      items.push(...ordered);
    }
    return items;
  })();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState<Date>(new Date());
  const [weather, setWeather] = useState<{ temp: string; city: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clock + date tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cycle playlist items
  useEffect(() => {
    if (flatItems.length === 0) return;
    const item = flatItems[currentIndex];
    if (!item) return;
    const id = setTimeout(() => {
      setCurrentIndex((currentIndex + 1) % flatItems.length);
    }, item.duration * 1000);
    return () => clearTimeout(id);
  }, [currentIndex, flatItems]);

  // Fetch weather for the first weather zone
  useEffect(() => {
    const weatherZone = zones.find(z => z.type === 'weather');
    if (!weatherZone) return;
    const city = (weatherZone.config?.city as string) || 'Sao Paulo';
    fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%t+%C&lang=pt`)
      .then(r => r.text())
      .then(t => setWeather({ temp: t.trim(), city }))
      .catch(() => setWeather({ temp: '--°C', city }));
  }, [zones]);

  const currentItem = flatItems[currentIndex];
  const isVideo = currentItem?.media.type === 'video';

  // Scale to fit the requested width/height while keeping aspect ratio
  const scaleX = width / layoutWidth;
  const scaleY = height / layoutHeight;
  const scale = Math.min(scaleX, scaleY);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden" style={{ width, height }}>
      {/* Close button overlay */}
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 transition-colors"
          aria-label="Fechar preview"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Scaled TV screen */}
      <div
        ref={containerRef}
        className="absolute bg-black"
        style={{
          width: layoutWidth,
          height: layoutHeight,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Render zones */}
        {zones.map((zone) => {
          const left = (zone.x / 100) * layoutWidth;
          const top = (zone.y / 100) * layoutHeight;
          const w = (zone.width / 100) * layoutWidth;
          const h = (zone.height / 100) * layoutHeight;
          const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left,
            top,
            width: w,
            height: h,
            overflow: 'hidden',
          };

          if (zone.type === 'mask') {
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  backgroundColor: (zone.config?.bg_color as string) || '#1F2937',
                  opacity: ((zone.config?.opacity as number) ?? 100) / 100,
                }}
              />
            );
          }

          if (zone.type === 'clock') {
            const format = (zone.config?.format as string) || '24h';
            const timeStr = format === '12h'
              ? now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
              : now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = now.toLocaleDateString('pt-BR');
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: (zone.config?.color as string) || '#FFFFFF',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontSize: Math.max(20, w / 8), fontFamily: 'monospace', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {timeStr}
                </div>
                <div style={{ fontSize: Math.max(10, w / 24), opacity: 0.8, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  {dateStr}
                </div>
              </div>
            );
          }

          if (zone.type === 'weather') {
            const city = (zone.config?.city as string) || 'Sao Paulo';
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: (zone.config?.color as string) || '#FFFFFF',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  padding: 8,
                }}
              >
                <div style={{ fontSize: Math.max(18, w / 6), fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {weather?.temp || '--°C'}
                </div>
                <div style={{ fontSize: Math.max(10, w / 20), opacity: 0.8, textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  {weather?.city || city}
                </div>
              </div>
            );
          }

          if (zone.type === 'text') {
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: (zone.config?.alignment as string) === 'left' ? 'flex-start'
                    : (zone.config?.alignment as string) === 'right' ? 'flex-end'
                    : 'center',
                  color: (zone.config?.color as string) || '#FFFFFF',
                  fontSize: Math.max(14, (zone.config?.font_size as number) || 24),
                  padding: 16,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  textAlign: ((zone.config?.alignment as 'left' | 'center' | 'right') || 'center'),
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
                dangerouslySetInnerHTML={{ __html: zone.content || '' }}
              />
            );
          }

          if (zone.type === 'logo') {
            const url = zone.config?.image_url as string;
            if (!url) {
              return (
                <div
                  key={zone.id}
                  style={{
                    ...baseStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#facc15',
                    fontWeight: 700,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    fontSize: Math.max(12, w / 12),
                  }}
                >
                  LOGO
                </div>
              );
            }
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (zone.config?.bg_color as string) || 'transparent',
                }}
              >
                <img src={url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            );
          }

          // type === 'campaign' — render current media item
          if (!currentItem) {
            return (
              <div
                key={zone.id}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  fontSize: Math.max(14, w / 20),
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                {flatItems.length === 0 ? 'Sem mídia vinculada' : 'Aguardando...'}
              </div>
            );
          }

          if (isVideo) {
            return (
              <video
                key={`${zone.id}-${currentItem.id}`}
                src={currentItem.media.file_url}
                autoPlay
                muted
                playsInline
                onEnded={() => setCurrentIndex((currentIndex + 1) % flatItems.length)}
                style={{ ...baseStyle, objectFit: 'cover' }}
              />
            );
          }

          return (
            <div key={`${zone.id}-${currentItem.id}`} style={baseStyle}>
              <img
                src={currentItem.media.file_url}
                alt={currentItem.media.name || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {currentItem.slotPartnerName && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: Math.max(10, w / 40),
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  📢 {currentItem.slotPartnerName}
                </div>
              )}
            </div>
          );
        })}

        {zones.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Layout vazio — adicione zonas na diagramação
          </div>
        )}
      </div>

      {/* Status bar (info) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-xs text-white/70 pointer-events-none">
        <div className="flex items-center justify-between">
          <div>
            {data.campaign?.name ? `📺 ${data.campaign.name}` : 'Preview sem campanha'}
            {' · '}
            {data.layout?.name || 'Layout'}
          </div>
          {flatItems.length > 0 && (
            <div>
              {currentIndex + 1}/{flatItems.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
