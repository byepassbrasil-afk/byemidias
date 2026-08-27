'use client';

import { useEffect, useState } from 'react';
import type { Playlist, PlaylistItem, Media } from '@/lib/types';

interface PlaylistSlot {
  id: string;
  playlist_id: string;
  partner_access_id: string;
  slot_order: number;
  duration_seconds: number;
  created_at: string;
  partner?: { id: string; username: string; display_name: string } | null;
}

type UnifiedItem = {
  type: 'media';
  id: string;
  position: number;
  media?: Media | null;
  duration: number | null;
  transition: string | null;
  volume: number | null;
  media_id: string;
} | {
  type: 'slot';
  id: string;
  position: number;
  partner_access_id: string;
  partner_name: string;
  partner_username: string;
  duration_seconds: number;
};

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Unified items management
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [itemDuration, setItemDuration] = useState(10);
  const [media, setMedia] = useState<Media[]>([]);

  // Add slot
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [partners, setPartners] = useState<{ id: string; username: string; display_name: string }[]>([]);
  const [newSlotPartnerId, setNewSlotPartnerId] = useState('');
  const [newSlotDuration, setNewSlotDuration] = useState(30);

  useEffect(() => { loadPlaylists(); loadOrgs(); loadPartners(); }, []);

  async function loadPlaylists() {
    const res = await fetch('/api/admin/crud/playlists?order=created_at&asc=false');
    const json = await res.json();
    setPlaylists(json.data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const res = await fetch('/api/admin/crud/organizations?order=name&asc=true');
    const json = await res.json();
    setOrgs((json.data ?? []) as { id: string; name: string }[]);
  }

  async function loadPartners() {
    const res = await fetch('/api/admin/crud/partner_access?order=username&asc=true');
    const json = await res.json();
    setPartners((json.data ?? []) as { id: string; username: string; display_name: string }[]);
  }

  function resetForm() {
    setName(''); setDescription(''); setOrganizationId(''); setEditing(null); setShowForm(false);
  }

  function startEdit(pl: Playlist) {
    setEditing(pl); setName(pl.name); setDescription(pl.description || ''); setOrganizationId(pl.organization_id); setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description: description || null, organization_id: organizationId, updated_at: new Date().toISOString() };
    if (editing) {
      await fetch('/api/admin/crud/playlists', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...payload }) });
    } else {
      await fetch('/api/admin/crud/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'active' }) });
    }
    resetForm(); setSaving(false); loadPlaylists();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const itemsRes = await fetch(`/api/admin/crud/playlist_items?playlist_id=${deleteId}`);
    const itemsJson = await itemsRes.json();
    for (const item of (itemsJson.data ?? [])) {
      await fetch(`/api/admin/crud/playlist_items?id=${item.id}`, { method: 'DELETE' });
    }
    // Delete slots too
    const slotsRes = await fetch(`/api/admin/crud/playlist_slots?playlist_id=${deleteId}`);
    const slotsJson = await slotsRes.json();
    for (const slot of (slotsJson.data ?? [])) {
      await fetch(`/api/admin/crud/playlist_slots?id=${slot.id}`, { method: 'DELETE' });
    }
    await fetch(`/api/admin/crud/playlists?id=${deleteId}`, { method: 'DELETE' });
    setDeleteId(null); loadPlaylists();
    if (selectedPlaylist?.id === deleteId) { setSelectedPlaylist(null); setUnifiedItems([]); }
  }

  // --- Unified Items Management ---

  async function openItems(playlist: Playlist) {
    setSelectedPlaylist(playlist);
    setItemsLoading(true);
    setShowAddMedia(false);
    setShowAddSlot(false);

    // Load both items and slots in parallel
    const [itemsRes, slotsRes, mediaRes, partnersRes] = await Promise.all([
      fetch(`/api/admin/crud/playlist_items?playlist_id=${playlist.id}&order=position&asc=true`),
      fetch(`/api/admin/crud/playlist_slots?playlist_id=${playlist.id}&order=slot_order&asc=true`),
      fetch('/api/admin/crud/media?order=created_at&asc=false'),
      fetch('/api/admin/crud/partner_access?order=username&asc=true'),
    ]);

    const itemsJson = await itemsRes.json();
    const slotsJson = await slotsRes.json();
    const mediaJson = await mediaRes.json();
    const partnersJson = await partnersRes.json();

    const allMedia = mediaJson.data ?? [];
    const mediaMap = new Map(allMedia.map((m: Media) => [m.id, m]));
    const partnerMap = new Map((partnersJson.data ?? []).map((p: { id: string; username: string; display_name: string }) => [p.id, p]));

    // Build unified list
    const mediaItems: UnifiedItem[] = (itemsJson.data ?? []).map((i: PlaylistItem & { slot_id?: string | null }) => ({
      type: 'media' as const,
      id: i.id,
      position: i.position,
      media: mediaMap.get(i.media_id) || null,
      duration: i.duration,
      transition: i.transition,
      volume: i.volume,
      media_id: i.media_id,
    }));

    const slotItems: UnifiedItem[] = (slotsJson.data ?? []).map((s: PlaylistSlot, idx: number) => {
      const partner = partnerMap.get(s.partner_access_id);
      return {
        type: 'slot' as const,
        id: s.id,
        position: mediaItems.length + idx, // slots go after media initially
        partner_access_id: s.partner_access_id,
        partner_name: partner?.display_name ?? 'Desconhecido',
        partner_username: partner?.username ?? '—',
        duration_seconds: s.duration_seconds,
      };
    });

    // Merge: slots get positions after media items
    setUnifiedItems([...mediaItems, ...slotItems]);
    setMedia(allMedia);
    setItemsLoading(false);
  }

  async function handleReorderItems() {
    if (!selectedPlaylist) return;
    // Save positions for media items
    for (let i = 0; i < unifiedItems.length; i++) {
      const item = unifiedItems[i];
      if (item.type === 'media') {
        await fetch('/api/admin/crud/playlist_items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, position: i }),
        });
      } else {
        await fetch('/api/admin/crud/playlist_slots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, slot_order: i }),
        });
      }
    }
  }

  async function moveItem(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= unifiedItems.length) return;

    const newItems = [...unifiedItems];
    const temp = newItems[idx];
    newItems[idx] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    setUnifiedItems(newItems);

    // Persist positions
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].type === 'media') {
        await fetch('/api/admin/crud/playlist_items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newItems[i].id, position: i }),
        });
      } else {
        await fetch('/api/admin/crud/playlist_slots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newItems[i].id, slot_order: i }),
        });
      }
    }
  }

  // --- Add Media ---

  function openAddMedia() {
    setShowAddMedia(true);
    setShowAddSlot(false);
    setSelectedMediaId('');
    setItemDuration(10);
    loadAvailableMedia();
  }

  async function loadAvailableMedia() {
    if (!selectedPlaylist) return;
    const existingMediaIds = unifiedItems.filter(i => i.type === 'media').map(i => i.media_id);
    const res = await fetch('/api/admin/crud/media?order=created_at&asc=false');
    const json = await res.json();
    let allMedia = json.data ?? [];
    if (existingMediaIds.length > 0) {
      allMedia = allMedia.filter((m: Media) => !existingMediaIds.includes(m.id));
    }
    setMedia(allMedia);
  }

  async function handleAddMedia() {
    if (!selectedPlaylist || !selectedMediaId) return;
    setSaving(true);
    const maxPos = unifiedItems.length;
    await fetch('/api/admin/crud/playlist_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_id: selectedPlaylist.id,
        media_id: selectedMediaId,
        position: maxPos,
        duration: itemDuration,
        transition: 'fade',
      }),
    });
    setShowAddMedia(false);
    setSaving(false);
    openItems(selectedPlaylist);
  }

  async function handleRemoveItem(item: UnifiedItem) {
    if (!selectedPlaylist) return;
    if (item.type === 'media') {
      await fetch(`/api/admin/crud/playlist_items?id=${item.id}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/admin/crud/playlist_slots?id=${item.id}`, { method: 'DELETE' });
    }
    const remaining = unifiedItems.filter(i => i.id !== item.id || i.type !== item.type);
    setUnifiedItems(remaining);
    // Persist new positions
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].type === 'media') {
        await fetch('/api/admin/crud/playlist_items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: remaining[i].id, position: i }) });
      } else {
        await fetch('/api/admin/crud/playlist_slots', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: remaining[i].id, slot_order: i }) });
      }
    }
  }

  async function handleUpdateDuration(item: UnifiedItem, newDuration: number) {
    if (!selectedPlaylist || item.type !== 'media') return;
    await fetch('/api/admin/crud/playlist_items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, duration: newDuration }) });
    setUnifiedItems(prev => prev.map(i => i.id === item.id && i.type === 'media' ? { ...i, duration: newDuration } : i));
  }

  async function handleUpdateTransition(item: UnifiedItem, newTransition: string) {
    if (!selectedPlaylist || item.type !== 'media') return;
    await fetch('/api/admin/crud/playlist_items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, transition: newTransition }) });
    setUnifiedItems(prev => prev.map(i => i.id === item.id && i.type === 'media' ? { ...i, transition: newTransition } : i));
  }

  async function handleUpdateSlotDuration(item: UnifiedItem, newDuration: number) {
    if (!selectedPlaylist || item.type !== 'slot') return;
    await fetch('/api/admin/crud/playlist_slots', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, duration_seconds: newDuration }) });
    setUnifiedItems(prev => prev.map(i => i.id === item.id && i.type === 'slot' ? { ...i, duration_seconds: newDuration } : i));
  }

  async function forceUpdateDevices() {
    if (!selectedPlaylist) return;
    const cpRes = await fetch(`/api/admin/crud/campaign_playlists?playlist_id=${selectedPlaylist.id}`);
    const cpJson = await cpRes.json();
    const campaigns = cpJson.data ?? [];
    if (campaigns.length === 0) { alert('Playlist não vinculada a nenhuma campanha.'); return; }
    for (const cp of campaigns) {
      const devRes = await fetch(`/api/admin/crud/devices?campaign_id=${cp.campaign_id}`);
      const devJson = await devRes.json();
      for (const d of (devJson.data ?? [])) {
        await fetch('/api/admin/rpc/bump_device_content_version', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_device_id: d.id }) });
      }
    }
    alert('Sync forçado nos dispositivos vinculados.');
  }

  // --- Add Slot ---

  function openAddSlot() {
    setShowAddSlot(true);
    setShowAddMedia(false);
    setNewSlotPartnerId('');
    setNewSlotDuration(30);
  }

  async function handleAddSlot() {
    if (!selectedPlaylist || !newSlotPartnerId) return;
    setSaving(true);
    const maxPos = unifiedItems.length;

    await fetch('/api/admin/crud/playlist_slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_id: selectedPlaylist.id,
        partner_access_id: newSlotPartnerId,
        duration_seconds: newSlotDuration,
        slot_order: maxPos,
      }),
    });

    setShowAddSlot(false);
    setNewSlotPartnerId('');
    setNewSlotDuration(30);
    setSaving(false);
    openItems(selectedPlaylist);
  }

  // --- Render ---

  if (selectedPlaylist) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedPlaylist(null); setUnifiedItems([]); }} className="text-gray-500 hover:text-gray-700 text-sm font-medium">← Voltar</button>
            <h1 className="text-2xl font-bold text-gray-900">{selectedPlaylist.name}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={openAddMedia} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Adicionar Mídia
            </button>
            <button onClick={openAddSlot} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
              + Adicionar Slot
            </button>
            <button onClick={forceUpdateDevices} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
              ⚡ Sync
            </button>
          </div>
        </div>

        {/* Add media gallery */}
        {showAddMedia && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Mídia</h3>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duração (s)</label>
                  <input type="number" value={itemDuration} onChange={e => setItemDuration(Number(e.target.value))} min={1} max={300}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 outline-none" />
                </div>
                <button onClick={() => setShowAddMedia(false)} className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 mt-5">✕ Fechar</button>
              </div>
            </div>
            {media.length === 0 ? (
              <p className="text-sm text-amber-600 py-8 text-center">Nenhuma mídia disponível</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto">
                {media.map(m => (
                  <button key={m.id} onClick={() => setSelectedMediaId(m.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedMediaId === m.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400'}`}>
                    <div className="aspect-square bg-gray-100">
                      {m.type === 'image' || m.type === 'gif' ? <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-purple-50"><span className="text-3xl">🎬</span></div>}
                    </div>
                    <div className="p-1.5"><p className="text-xs text-gray-700 truncate">{m.name}</p></div>
                    {selectedMediaId === m.id && <div className="absolute top-1 right-1 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center"><span className="text-white text-xs">✓</span></div>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={handleAddMedia} disabled={!selectedMediaId || saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Add slot form */}
        {showAddSlot && (
          <div className="mb-6 rounded-xl bg-purple-50 p-6 border border-purple-200 space-y-4">
            <h3 className="text-lg font-semibold text-purple-900">Adicionar Slot Reservado</h3>
            <p className="text-sm text-purple-700">O slot será adicionado ao final da playlist. Você pode reordenar depois.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parceiro</label>
                <select value={newSlotPartnerId} onChange={e => setNewSlotPartnerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none">
                  <option value="">Selecione...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.username})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração (segundos)</label>
                <select value={newSlotDuration} onChange={e => setNewSlotDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none">
                  <option value={15}>15s</option><option value={30}>30s</option><option value={45}>45s</option>
                  <option value={60}>60s</option><option value={90}>90s</option><option value={120}>120s</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddSlot} disabled={!newSlotPartnerId || saving}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Adicionando...' : 'Adicionar Slot'}
              </button>
              <button onClick={() => setShowAddSlot(false)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        )}

        {/* Unified items list */}
        {itemsLoading ? (
          <div className="text-gray-500 py-12 text-center">Carregando...</div>
        ) : unifiedItems.length === 0 ? (
          <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500 mb-2">Playlist vazia</p>
            <p className="text-sm text-gray-400">Adicione mídia ou slots reservados para parceiros</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conteúdo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transição</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unifiedItems.map((item, idx) => (
                  <tr key={`${item.type}-${item.id}`} className={`hover:bg-gray-50 ${item.type === 'slot' ? 'bg-purple-50/50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 text-center">{idx + 1}</td>
                    <td className="px-4 py-3">
                      {item.type === 'slot' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          🕐 Slot Parceiro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {item.media?.type === 'video' ? '🎬' : item.media?.type === 'gif' ? '🖼️' : '🖼️'} Mídia
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === 'slot' ? (
                        <div>
                          <p className="text-sm font-medium text-purple-900">{item.partner_name}</p>
                          <p className="text-xs text-purple-500">@{item.partner_username}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                            {item.media?.type === 'image' || item.media?.type === 'gif' ? (
                              <img src={item.media?.file_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 truncate max-w-[200px]">{item.media?.name ?? item.media_id}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === 'slot' ? (
                        <select value={item.duration_seconds} onChange={e => handleUpdateSlotDuration(item, Number(e.target.value))}
                          className="rounded border border-purple-300 px-2 py-1 text-sm focus:border-purple-500 outline-none">
                          <option value={15}>15s</option><option value={30}>30s</option><option value={45}>45s</option>
                          <option value={60}>60s</option><option value={90}>90s</option><option value={120}>120s</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input type="number" value={item.duration ?? 10} onChange={e => handleUpdateDuration(item, Number(e.target.value))}
                            min={1} max={300} className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-blue-500 outline-none" />
                          <span className="text-xs text-gray-400">s</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === 'slot' ? (
                        <span className="text-xs text-gray-400 italic">Reservado</span>
                      ) : (
                        <select value={item.transition ?? 'fade'} onChange={e => handleUpdateTransition(item, e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 outline-none">
                          <option value="cut">Corte</option><option value="fade">Fade</option>
                          <option value="slide_left">Deslizar E</option><option value="slide_right">Deslizar D</option>
                          <option value="slide_up">Deslizar C</option><option value="slide_down">Deslizar B</option>
                          <option value="zoom">Zoom</option><option value="dissolve">Dissolver</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0}
                          className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30" title="Subir">↑</button>
                        <button onClick={() => moveItem(idx, 'down')} disabled={idx === unifiedItems.length - 1}
                          className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30" title="Descer">↓</button>
                        <button onClick={() => handleRemoveItem(item)}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 ml-1" title="Remover">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Main playlists view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Playlists</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Nova Playlist</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Playlist' : 'Nova Playlist'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
              <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">Selecione...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-50 p-6 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir esta playlist e todos os seus itens?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : playlists.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhuma playlist encontrada.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map(pl => (
            <div key={pl.id} className="group rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{pl.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pl.description || 'Sem descrição'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${pl.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{pl.status}</span>
                <span className="text-xs text-gray-400">{new Date(pl.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                <button onClick={() => openItems(pl)} className="flex-1 rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors">
                  🎬 Gerenciar Itens
                </button>
                <button onClick={() => startEdit(pl)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">✏️</button>
                <button onClick={() => setDeleteId(pl.id)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
