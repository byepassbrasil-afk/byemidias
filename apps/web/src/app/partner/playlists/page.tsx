'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@byemidias/shared';

interface PlaylistSlot {
  id: string;
  playlist_id: string;
  partner_access_id: string;
  slot_order: number;
  duration_seconds: number;
  playlist_name?: string;
}

interface SlotItem {
  id: string;
  media_id: string;
  position: number;
  duration: number | null;
  slot_id: string | null;
  media?: Media | null;
}

export default function PartnerPlaylistPage() {
  const [slots, setSlots] = useState<PlaylistSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PlaylistSlot | null>(null);
  const [items, setItems] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSlots();
  }, []);

  async function loadSlots() {
    try {
      const res = await fetch('/api/partner/slots');
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function loadSlotItems(slot: PlaylistSlot) {
    setSelectedSlot(slot);
    try {
      const res = await fetch(`/api/partner/slots/${slot.id}/items`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !selectedSlot) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slot_id', selectedSlot.id);

      try {
        const res = await fetch('/api/partner/media', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Erro ao enviar arquivo');
        }
      } catch {
        setError('Erro de conexão ao enviar arquivo');
      }
    }

    setUploading(false);
    loadSlotItems(selectedSlot);
  }

  async function handleDelete(itemId: string, mediaId: string) {
    if (!confirm('Tem certeza que deseja remover este item?') || !selectedSlot) return;

    try {
      const res = await fetch(`/api/partner/slots/${selectedSlot.id}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao remover');
        return;
      }

      loadSlotItems(selectedSlot);
    } catch {
      setError('Erro ao remover item');
    }
  }

  async function handleMoveUp(item: SlotItem, idx: number) {
    if (!selectedSlot || idx === 0) return;
    const prevItem = items[idx - 1];
    if (!prevItem) return;

    // Swap positions
    await fetch(`/api/partner/slots/${selectedSlot.id}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: item.id, position: prevItem.position },
          { id: prevItem.id, position: item.position },
        ],
      }),
    });

    loadSlotItems(selectedSlot);
  }

  async function handleMoveDown(item: SlotItem, idx: number) {
    if (!selectedSlot || idx === items.length - 1) return;
    const nextItem = items[idx + 1];
    if (!nextItem) return;

    await fetch(`/api/partner/slots/${selectedSlot.id}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: item.id, position: nextItem.position },
          { id: nextItem.id, position: item.position },
        ],
      }),
    });

    loadSlotItems(selectedSlot);
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  // If a slot is selected, show its items
  if (selectedSlot) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedSlot(null); setItems([]); }} className="text-gray-400 hover:text-white text-sm font-medium">
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Meu Slot</h1>
              <p className="text-sm text-gray-400">
                Posição {selectedSlot.slot_order + 1} · {formatDuration(selectedSlot.duration_seconds)}
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Enviando...' : '+ Enviar Arquivo'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 p-3 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl bg-gray-800 p-12 text-center">
            <p className="text-gray-400">Nenhum item neste slot.</p>
            <p className="text-sm text-gray-500 mt-1">Envie arquivos para preencher seu espaço reservado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4 rounded-xl bg-gray-800 border border-gray-700 p-4">
                <span className="text-sm text-gray-400 w-6 text-center">{idx + 1}</span>
                <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.media?.type === 'image' || item.media?.type === 'gif' ? (
                    <img src={item.media?.file_url} alt="" className="w-full h-full object-cover" />
                  ) : item.media?.type === 'video' ? (
                    <div className="text-2xl">🎬</div>
                  ) : (
                    <div className="text-2xl">📄</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.media?.name ?? 'Carregando...'}</p>
                  <p className="text-xs text-gray-500">{item.media?.type ?? '—'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveUp(item, idx)}
                    disabled={idx === 0}
                    className="rounded p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(item, idx)}
                    disabled={idx === items.length - 1}
                    className="rounded p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.media_id)}
                    className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 ml-1"
                    title="Remover"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main view: show available slots
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Meus Slots</h1>
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : slots.length === 0 ? (
        <div className="rounded-xl bg-gray-800 p-12 text-center">
          <p className="text-gray-400">Nenhum slot reservado para você.</p>
          <p className="text-sm text-gray-500 mt-1">O administrador precisa criar slots reservados nas playlists.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => (
            <div
              key={slot.id}
              onClick={() => loadSlotItems(slot)}
              className="rounded-xl bg-gray-800 border border-gray-700 p-6 cursor-pointer hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{slot.playlist_name || 'Playlist'}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Slot {slot.slot_order + 1} · {formatDuration(slot.duration_seconds)}
                  </p>
                </div>
                <div className="text-blue-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
