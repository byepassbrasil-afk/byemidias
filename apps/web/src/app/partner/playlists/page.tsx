'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';

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

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [partnerMedia, setPartnerMedia] = useState<Media[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [addingMediaId, setAddingMediaId] = useState<string | null>(null);

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

  async function openMediaPicker() {
    setShowMediaPicker(true);
    setLoadingMedia(true);
    try {
      const res = await fetch('/api/partner/media');
      const data = await res.json();
      setPartnerMedia(data.media ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoadingMedia(false);
  }

  async function handleAddMediaToSlot(mediaId: string) {
    if (!selectedSlot) return;
    setAddingMediaId(mediaId);
    setError(null);

    try {
      const res = await fetch('/api/partner/playlists/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: selectedSlot.playlist_id,
          action: 'add',
          media_id: mediaId,
          slot_id: selectedSlot.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao adicionar mídia');
      } else {
        loadSlotItems(selectedSlot);
        setShowMediaPicker(false);
      }
    } catch {
      setError('Erro de conexão');
    }
    setAddingMediaId(null);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !selectedSlot) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const ct = new FormData();
        ct.append('file', file);

        const presignRes = await fetch('/api/partner/media', {
          method: 'POST',
          body: ct,
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json();
          setError(errData.error || 'Erro ao gerar upload URL');
          continue;
        }

        const { upload_url, public_url, file_name, file_size, content_type } = await presignRes.json();

        const putRes = await fetch(upload_url, {
          method: 'PUT',
          body: file,
        });

        if (!putRes.ok) {
          setError('Erro ao enviar arquivo para storage');
          continue;
        }

        const saveRes = await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name, mime_type: content_type, file_url: public_url, file_size }),
        });

        const saveData = await saveRes.json();
        if (saveRes.ok && saveData.mediaId) {
          await fetch('/api/partner/playlists/modify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playlist_id: selectedSlot.playlist_id,
              action: 'add',
              media_id: saveData.mediaId,
              slot_id: selectedSlot.id,
            }),
          });
        }
      } catch {
        setError('Erro de conexão ao enviar arquivo');
      }
    }

    setUploading(false);
    loadSlotItems(selectedSlot);
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Tem certeza que deseja remover este item?') || !selectedSlot) return;

    try {
      const res = await fetch(`/api/partner/slots/${selectedSlot.id}/items/${itemId}`, { method: 'DELETE' });
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

  async function handleMove(item: SlotItem, direction: 'up' | 'down') {
    if (!selectedSlot) return;
    const idx = items.indexOf(item);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const target = items[targetIdx];
    await fetch(`/api/partner/slots/${selectedSlot.id}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: item.id, position: target.position },
          { id: target.id, position: item.position },
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
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={(e) => handleUpload(e.target.files)} className="hidden" />
            <button onClick={openMediaPicker}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
              + Adicionar Mídia
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {uploading ? 'Enviando...' : '+ Enviar Arquivo'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 p-3 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
          </div>
        )}

        {showMediaPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="rounded-xl bg-gray-900 border border-gray-700 p-6 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Selecionar Mídia</h2>
                <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-white text-sm">Fechar</button>
              </div>
              {loadingMedia ? (
                <div className="text-gray-400 py-8 text-center">Carregando mídia...</div>
              ) : partnerMedia.length === 0 ? (
                <div className="text-gray-400 py-8 text-center">
                  <p>Nenhuma mídia disponível.</p>
                  <p className="text-sm text-gray-500 mt-1">Envie arquivos na aba "Mídia" primeiro.</p>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {partnerMedia.map((m) => (
                    <div key={m.id}
                      onClick={() => handleAddMediaToSlot(m.id)}
                      className={`group relative rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                        addingMediaId === m.id ? 'border-blue-500 opacity-50' : 'border-transparent hover:border-blue-400'
                      }`}>
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        {m.type === 'image' || m.type === 'gif' ? (
                          <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" />
                        ) : m.type === 'video' ? (
                          <div className="text-3xl">🎬</div>
                        ) : (
                          <div className="text-3xl">📄</div>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                        <p className="text-xs text-white truncate">{m.name}</p>
                      </div>
                      {addingMediaId === m.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="text-white text-sm">Adicionando...</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl bg-gray-800 p-12 text-center">
            <p className="text-gray-400">Nenhum item neste slot.</p>
            <p className="text-sm text-gray-500 mt-1">Envie arquivos ou adicione mídia existente para preencher seu espaço.</p>
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
                  <button onClick={() => handleMove(item, 'up')} disabled={idx === 0}
                    className="rounded p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para cima">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => handleMove(item, 'down')} disabled={idx === items.length - 1}
                    className="rounded p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para baixo">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 ml-1" title="Remover">
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
            <div key={slot.id} onClick={() => loadSlotItems(slot)}
              className="rounded-xl bg-gray-800 border border-gray-700 p-6 cursor-pointer hover:border-blue-500 transition-colors">
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
