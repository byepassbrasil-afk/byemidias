'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';

interface PlaylistSlot { id: string; playlist_id: string; partner_access_id: string; slot_order: number; duration_seconds: number; playlist_name?: string; }
interface SlotItem { id: string; media_id: string; position: number; duration: number | null; slot_id: string | null; media?: Media | null; }

export default function PartnerSlugPlaylistsPage() {
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

  useEffect(() => { loadSlots(); }, []);

  async function loadSlots() {
    try { const res = await fetch('/api/partner/slots'); const data = await res.json(); setSlots(data.slots ?? []); } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadSlotItems(slot: PlaylistSlot) {
    setSelectedSlot(slot);
    try { const res = await fetch(`/api/partner/slots/${slot.id}/items`); const data = await res.json(); setItems(data.items ?? []); } catch { /* ignore */ }
  }

  async function openMediaPicker() {
    setShowMediaPicker(true); setLoadingMedia(true);
    try { const res = await fetch('/api/partner/media'); const data = await res.json(); setPartnerMedia(data.media ?? []); } catch { /* ignore */ }
    setLoadingMedia(false);
  }

  async function handleAddMediaToSlot(mediaId: string) {
    if (!selectedSlot) return;
    setAddingMediaId(mediaId); setError(null);
    try {
      const res = await fetch('/api/partner/playlists/modify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playlist_id: selectedSlot.playlist_id, action: 'add', media_id: mediaId, slot_id: selectedSlot.id }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Erro ao adicionar mídia');
      else { loadSlotItems(selectedSlot); setShowMediaPicker(false); }
    } catch { setError('Erro de conexão'); }
    setAddingMediaId(null);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !selectedSlot) return;
    setUploading(true); setError(null);
    for (const file of Array.from(files)) {
      try {
        // Step 1: get presigned URL (JSON only, no file upload through Vercel)
        const presignRes = await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'presign',
            file_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
          }),
        });
        if (!presignRes.ok) { const errData = await presignRes.json().catch(() => ({})); setError(errData.error || 'Erro ao gerar upload URL'); continue; }
        const { upload_url, public_url, file_name, file_size, content_type } = await presignRes.json();
        // Step 2: upload directly to R2 (bypasses Vercel body limit)
        const putRes = await fetch(upload_url, { method: 'PUT', body: file });
        if (!putRes.ok) { setError(`Erro ao enviar arquivo para storage (HTTP ${putRes.status})`); continue; }
        // Step 3: save media record in DB
        const saveRes = await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', file_name, mime_type: content_type, file_url: public_url, file_size }),
        });
        const saveData = await saveRes.json();
        if (saveRes.ok && saveData.mediaId) {
          await fetch('/api/partner/playlists/modify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playlist_id: selectedSlot.playlist_id, action: 'add', media_id: saveData.mediaId, slot_id: selectedSlot.id }) });
        }
      } catch (e: any) {
        setError(`Erro de conexão: ${e?.message || 'desconhecido'}`);
      }
    }
    setUploading(false); loadSlotItems(selectedSlot);
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Tem certeza que deseja remover este item?') || !selectedSlot) return;
    try { const res = await fetch(`/api/partner/slots/${selectedSlot.id}/items/${itemId}`, { method: 'DELETE' }); if (!res.ok) { const data = await res.json(); setError(data.error || 'Erro ao remover'); return; } loadSlotItems(selectedSlot); } catch { setError('Erro ao remover item'); }
  }

  async function handleMove(item: SlotItem, direction: 'up' | 'down') {
    if (!selectedSlot) return;
    const idx = items.indexOf(item); const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const target = items[targetIdx];
    await fetch(`/api/partner/slots/${selectedSlot.id}/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: item.id, position: target.position }, { id: target.id, position: item.position }] }) });
    loadSlotItems(selectedSlot);
  }

  function formatDuration(s: number | null) { if (!s) return '—'; if (s < 60) return `${s}s`; return `${Math.floor(s / 60)}m ${s % 60}s`; }

  // Slot detail view
  if (selectedSlot) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedSlot(null); setItems([]); }} className="text-gray-400 hover:text-white text-sm">← Voltar</button>
            <div>
              <h1 className="text-xl font-bold text-white">{selectedSlot.playlist_name || 'Playlist'}</h1>
              <p className="text-xs text-gray-500">Slot {selectedSlot.slot_order + 1} · {formatDuration(selectedSlot.duration_seconds)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={e => handleUpload(e.target.files)} className="hidden" />
            <button onClick={openMediaPicker} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors">Selecionar Mídia</button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-900/20 border border-red-800/50 p-3 text-sm text-red-400 flex justify-between"><span>{error}</span><button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">×</button></div>}

        {showMediaPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Selecionar Mídia</h2>
                <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              {loadingMedia ? (
                <div className="text-gray-500 py-8 text-center text-sm">Carregando...</div>
              ) : partnerMedia.length === 0 ? (
                <div className="text-gray-500 py-8 text-center text-sm">Nenhuma mídia disponível</div>
              ) : (
                <div className="overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {partnerMedia.map(m => (
                    <div key={m.id} onClick={() => handleAddMediaToSlot(m.id)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${addingMediaId === m.id ? 'border-blue-500 opacity-50' : 'border-transparent hover:border-blue-400'}`}>
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        {m.type === 'image' || m.type === 'gif' ? <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" /> : <span className="text-3xl">{m.type === 'video' ? '🎬' : '📄'}</span>}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1"><p className="text-[10px] text-white truncate">{m.name}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-12 text-center">
            <p className="text-gray-400">Nenhum item neste slot</p>
            <p className="text-xs text-gray-600 mt-1">Adicione mídia para preencher seu espaço</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-gray-900 border border-gray-800 p-3 sm:p-4">
                <span className="text-xs text-gray-600 w-6 text-center shrink-0">{idx + 1}</span>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                  {item.media?.type === 'image' || item.media?.type === 'gif' ? <img src={item.media?.file_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">{item.media?.type === 'video' ? '🎬' : '📄'}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.media?.name ?? 'Carregando...'}</p>
                  <p className="text-[10px] text-gray-600">{item.media?.type ?? '—'}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => handleMove(item, 'up')} disabled={idx === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-gray-800 disabled:opacity-20">↑</button>
                  <button onClick={() => handleMove(item, 'down')} disabled={idx === items.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-gray-800 disabled:opacity-20">↓</button>
                  <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-gray-800">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Slots list view
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Meus Slots</h1>
        <p className="text-sm text-gray-500 mt-1">Espaços reservados para seu conteúdo</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhum slot reservado</p>
          <p className="text-sm text-gray-600 mt-1">O administrador precisa criar slots reservados nas playlists</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map(slot => (
            <button key={slot.id} onClick={() => loadSlotItems(slot)}
              className="w-full text-left rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{slot.playlist_name || 'Playlist'}</h3>
                  <p className="text-xs text-gray-500 mt-1">Slot {slot.slot_order + 1} · {formatDuration(slot.duration_seconds)}</p>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
