'use client';

import { useEffect, useState } from 'react';
import type { Playlist, PlaylistItem, Media } from '@/lib/types';
import type { Organization } from '@/lib/types';

interface PlaylistSlot {
  id: string;
  playlist_id: string;
  partner_access_id: string;
  slot_order: number;
  duration_seconds: number;
  created_at: string;
  partner?: { id: string; username: string; display_name: string } | null;
}

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

  // Playlist items management
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<(PlaylistItem & { media?: Media })[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [itemDuration, setItemDuration] = useState(10);

  // Slot management
  const [selectedPlaylistForSlots, setSelectedPlaylistForSlots] = useState<Playlist | null>(null);
  const [slots, setSlots] = useState<PlaylistSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [partners, setPartners] = useState<{ id: string; username: string; display_name: string }[]>([]);
  const [showAddSlot, setShowAddSlot] = useState(false);
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
      await fetch('/api/admin/crud/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
    } else {
      await fetch('/api/admin/crud/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, status: 'active' }),
      });
    }
    resetForm(); setSaving(false); loadPlaylists();
  }

  async function handleDelete() {
    if (!deleteId) return;
    // Delete playlist items first
    const itemsRes = await fetch(`/api/admin/crud/playlist_items?playlist_id=${deleteId}`);
    const itemsJson = await itemsRes.json();
    for (const item of (itemsJson.data ?? [])) {
      await fetch(`/api/admin/crud/playlist_items?id=${item.id}`, { method: 'DELETE' });
    }
    await fetch(`/api/admin/crud/playlists?id=${deleteId}`, { method: 'DELETE' });
    setDeleteId(null); loadPlaylists();
    if (selectedPlaylist?.id === deleteId) { setSelectedPlaylist(null); setItems([]); }
  }

  // --- Playlist Items Management ---

  async function openItems(playlist: Playlist) {
    setSelectedPlaylist(playlist);
    setItemsLoading(true);
    setShowAddMedia(false);

    const res = await fetch(`/api/admin/crud/playlist_items?playlist_id=${playlist.id}&order=position&asc=true`);
    const json = await res.json();
    const itemsData = json.data ?? [];

    if (itemsData.length > 0) {
      const mediaIds = itemsData.map((i: PlaylistItem) => i.media_id);
      const mediaRes = await fetch(`/api/admin/crud/media`);
      const mediaJson = await mediaRes.json();
      const allMedia = mediaJson.data ?? [];
      const mediaMap = new Map(allMedia.map((m: Media) => [m.id, m]));
      setItems(itemsData.map((i: PlaylistItem) => ({ ...i, media: mediaMap.get(i.media_id) })));
    } else {
      setItems(itemsData);
    }
    setItemsLoading(false);
  }

  async function loadAvailableMedia() {
    if (!selectedPlaylist) return;
    const existingMediaIds = items.map(i => i.media_id);
    const res = await fetch('/api/admin/crud/media?order=created_at&asc=false');
    const json = await res.json();
    let allMedia = json.data ?? [];
    if (existingMediaIds.length > 0) {
      allMedia = allMedia.filter((m: Media) => !existingMediaIds.includes(m.id));
    }
    setMedia(allMedia);
  }

  function openAddMedia() {
    setShowAddMedia(true);
    setSelectedMediaId('');
    setItemDuration(10);
    loadAvailableMedia();
  }

  async function handleAddMedia() {
    if (!selectedPlaylist || !selectedMediaId) return;
    setSaving(true);

    const maxPos = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;

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

  async function handleRemoveItem(item: PlaylistItem) {
    if (!selectedPlaylist) return;
    await fetch(`/api/admin/crud/playlist_items?id=${item.id}`, { method: 'DELETE' });
    const remaining = items.filter(i => i.id !== item.id);
    for (let i = 0; i < remaining.length; i++) {
      await fetch('/api/admin/crud/playlist_items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: remaining[i].id, position: i }),
      });
    }
    openItems(selectedPlaylist);
  }

  async function handleMoveUp(item: PlaylistItem) {
    if (!selectedPlaylist || item.position === 0) return;
    const currentIdx = items.findIndex(i => i.id === item.id);
    const prevItem = items[currentIdx - 1];
    if (!prevItem) return;

    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prevItem.id, position: item.position }),
    });
    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, position: item.position - 1 }),
    });
    openItems(selectedPlaylist);
  }

  async function handleMoveDown(item: PlaylistItem) {
    if (!selectedPlaylist || item.position === items.length - 1) return;
    const currentIdx = items.findIndex(i => i.id === item.id);
    const nextItem = items[currentIdx + 1];
    if (!nextItem) return;

    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nextItem.id, position: item.position }),
    });
    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, position: item.position + 1 }),
    });
    openItems(selectedPlaylist);
  }

  async function handleUpdateDuration(item: PlaylistItem, newDuration: number) {
    if (!selectedPlaylist) return;
    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, duration: newDuration }),
    });
    openItems(selectedPlaylist);
  }

  async function handleUpdateVolume(item: PlaylistItem, newVolume: number) {
    if (!selectedPlaylist) return;
    await fetch('/api/admin/crud/playlist_items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, volume: newVolume }),
    });
    openItems(selectedPlaylist);
  }

  async function forceUpdateDevices() {
    if (!selectedPlaylist) return;
    const cpRes = await fetch(`/api/admin/crud/campaign_playlists?playlist_id=${selectedPlaylist.id}`);
    const cpJson = await cpRes.json();
    const campaigns = cpJson.data ?? [];
    if (campaigns.length === 0) { alert('Playlist nao vinculada a nenhuma campanha.'); return; }
    for (const cp of campaigns) {
      const devRes = await fetch(`/api/admin/crud/devices?campaign_id=${cp.campaign_id}`);
      const devJson = await devRes.json();
      for (const d of (devJson.data ?? [])) {
        await fetch('/api/admin/rpc/bump_device_content_version', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_device_id: d.id }),
        });
      }
    }
    alert('Sync forçado nos dispositivos vinculados.');
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  // --- Slot Management ---

  async function openSlots(playlist: Playlist) {
    setSelectedPlaylistForSlots(playlist);
    setSlotsLoading(true);
    setShowAddSlot(false);

    const res = await fetch(`/api/admin/crud/playlist_slots?playlist_id=${playlist.id}&order=slot_order&asc=true`);
    const json = await res.json();
    const slotsData = json.data ?? [];

    // Enrich with partner info
    const partnerRes = await fetch('/api/admin/crud/partner_access?order=username&asc=true');
    const partnerJson = await partnerRes.json();
    const partnerMap = new Map((partnerJson.data ?? []).map((p: { id: string; username: string; display_name: string }) => [p.id, p]));

    setSlots(slotsData.map((s: PlaylistSlot) => ({
      ...s,
      partner: partnerMap.get(s.partner_access_id) || null,
    })));
    setSlotsLoading(false);
  }

  async function handleAddSlot() {
    if (!selectedPlaylistForSlots || !newSlotPartnerId) return;
    setSaving(true);

    const res = await fetch('/api/admin/crud/playlist_slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_id: selectedPlaylistForSlots.id,
        partner_access_id: newSlotPartnerId,
        duration_seconds: newSlotDuration,
        slot_order: slots.length,
      }),
    });
    const json = await res.json();
    if (json.error) alert('Erro: ' + json.error);

    setShowAddSlot(false);
    setNewSlotPartnerId('');
    setNewSlotDuration(30);
    setSaving(false);
    openSlots(selectedPlaylistForSlots);
  }

  async function handleDeleteSlot(slotId: string) {
    if (!selectedPlaylistForSlots) return;
    if (!confirm('Excluir este slot e seus itens?')) return;

    // Delete items in this slot
    const itemsRes = await fetch(`/api/admin/crud/playlist_items?slot_id=${slotId}`);
    const itemsJson = await itemsRes.json();
    for (const item of (itemsJson.data ?? [])) {
      await fetch(`/api/admin/crud/playlist_items?id=${item.id}`, { method: 'DELETE' });
    }
    await fetch(`/api/admin/crud/playlist_slots?id=${slotId}`, { method: 'DELETE' });

    openSlots(selectedPlaylistForSlots);
  }

  async function handleUpdateSlotDuration(slotId: string, newDuration: number) {
    if (!selectedPlaylistForSlots) return;
    await fetch('/api/admin/crud/playlist_slots', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotId, duration_seconds: newDuration }),
    });
    openSlots(selectedPlaylistForSlots);
  }

  // If managing slots for a playlist, show that view
  if (selectedPlaylistForSlots) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedPlaylistForSlots(null); setSlots([]); }} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Slots — {selectedPlaylistForSlots.name}</h1>
          </div>
          <button onClick={() => { setShowAddSlot(true); setNewSlotPartnerId(''); setNewSlotDuration(30); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Novo Slot
          </button>
        </div>

        {/* Add slot form */}
        {showAddSlot && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Adicionar Slot Reservado</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parceiro</label>
                <select value={newSlotPartnerId} onChange={(e) => setNewSlotPartnerId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="">Selecione um parceiro...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name} ({p.username})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração (segundos)</label>
                <select value={newSlotDuration} onChange={(e) => setNewSlotDuration(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                  <option value={90}>90s</option>
                  <option value={120}>120s</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddSlot} disabled={!newSlotPartnerId || saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Adicionando...' : 'Adicionar Slot'}
              </button>
              <button onClick={() => setShowAddSlot(false)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        )}

        {/* Slots list */}
        {slotsLoading ? (
          <div className="text-gray-500">Carregando slots...</div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500 mb-2">Nenhum slot reservado nesta playlist.</p>
            <p className="text-sm text-gray-400">Adicione slots para que parceiros possam inserir seu conteúdo.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parceiro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slots.map((slot, idx) => (
                  <tr key={slot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 text-center">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{slot.partner?.display_name ?? 'Desconhecido'}</p>
                      <p className="text-xs text-gray-500">@{slot.partner?.username ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={slot.duration_seconds}
                        onChange={(e) => handleUpdateSlotDuration(slot.id, Number(e.target.value))}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value={15}>15s</option>
                        <option value={30}>30s</option>
                        <option value={45}>45s</option>
                        <option value={60}>60s</option>
                        <option value={90}>90s</option>
                        <option value={120}>120s</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Excluir slot"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
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

  // If a playlist is selected for item management, show that view
  if (selectedPlaylist) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedPlaylist(null); setItems([]); }} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Itens — {selectedPlaylist.name}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={openAddMedia} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Adicionar Mídia
            </button>
            <button onClick={forceUpdateDevices} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
              ⚡ Forçar Atualização
            </button>
          </div>
        </div>

        {/* Add media gallery */}
        {showAddMedia && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Mídia à Playlist</h3>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duração (segundos)</label>
                  <input type="number" value={itemDuration} onChange={(e) => setItemDuration(Number(e.target.value))} min={1} max={300}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 outline-none" />
                </div>
                <button onClick={() => setShowAddMedia(false)}
                  className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 mt-5">✕ Fechar</button>
              </div>
            </div>

            {media.length === 0 ? (
              <p className="text-sm text-amber-600 py-8 text-center">Nenhuma mídia disponível. Faça upload em /media.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto">
                {media.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMediaId(m.id)}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                      selectedMediaId === m.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100">
                      {m.type === 'image' || m.type === 'gif' ? (
                        <img src={m.file_url} alt={m.name} className="w-full h-full object-cover" />
                      ) : m.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-purple-50">
                          <span className="text-3xl">🎬</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl">📄</span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-xs text-gray-700 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.type} · {m.file_size ? `${(m.file_size / 1024).toFixed(0)} KB` : ''}</p>
                    </div>
                    {selectedMediaId === m.id && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={handleAddMedia} disabled={!selectedMediaId || saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Adicionando...' : `Adicionar (${selectedMediaId ? '1 selecionada' : 'nenhuma'})`}
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        {itemsLoading ? (
          <div className="text-gray-500">Carregando itens...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500 mb-2">Nenhum item nesta playlist.</p>
            <p className="text-sm text-gray-400">Clique em &quot;+ Adicionar Mídia&quot; para começar.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transição</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 text-center">{item.position + 1}</td>
                    <td className="px-4 py-3">
                      {item.media?.type === 'image' || item.media?.type === 'gif' ? (
                        <img src={item.media?.file_url} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : item.media?.type === 'video' ? (
                        <div className="w-12 h-12 rounded bg-purple-100 flex items-center justify-center text-lg">🎬</div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-lg">📄</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.media?.name ?? item.media_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.media?.type ?? '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.duration ?? 10}
                        onChange={(e) => handleUpdateDuration(item, Number(e.target.value))}
                        min={1} max={300}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs text-gray-400 ml-1">s</span>
                    </td>
                    <td className="px-4 py-3">
                      {item.media?.type === 'video' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">🔊</span>
                          <input
                            type="number"
                            value={item.volume ?? 100}
                            onChange={(e) => handleUpdateVolume(item, Number(e.target.value))}
                            min={0} max={100}
                            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-blue-500 outline-none"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.transition ?? 'fade'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleMoveUp(item)}
                          disabled={idx === 0}
                          className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para cima"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(item)}
                          disabled={idx === items.length - 1}
                          className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para baixo"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item)}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 ml-1"
                          title="Remover"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
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
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
              <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">Selecione...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
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
          {playlists.map((pl) => (
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
                <button onClick={() => openItems(pl)} className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                  📋 Gerenciar Itens
                </button>
                <button onClick={() => openSlots(pl)} className="flex-1 rounded-lg bg-purple-100 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors">
                  🕐 Gerenciar Slots
                </button>
                <button onClick={() => startEdit(pl)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                  ✏️
                </button>
                <button onClick={() => setDeleteId(pl.id)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
