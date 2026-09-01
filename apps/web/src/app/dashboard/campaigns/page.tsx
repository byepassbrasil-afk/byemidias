'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Campaign, CampaignStatus } from '@/lib/types';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState(3);
  const [status, setStatus] = useState<CampaignStatus>('draft');
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCampaigns(); loadOrgs(); loadPlaylists(); }, []);

  async function loadCampaigns() {
    const res = await fetch('/api/admin/crud/campaigns?order=created_at&asc=false');
    const json = await res.json();
    setCampaigns(json.data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const res = await fetch('/api/admin/crud/organizations?order=name&asc=true');
    const json = await res.json();
    setOrgs((json.data ?? []) as { id: string; name: string }[]);
  }

  async function loadPlaylists() {
    const res = await fetch('/api/admin/crud/playlists?order=name&asc=true');
    const json = await res.json();
    setPlaylists((json.data ?? []) as { id: string; name: string }[]);
  }

  function resetForm() {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setPriority(3); setStatus('draft'); setSelectedPlaylists([]); setOrganizationId(''); setEditing(null); setShowForm(false);
  }

  async function startEdit(c: Campaign) {
    setEditing(c);
    setName(c.name); setDescription(c.description || ''); setStartDate(c.start_date || ''); setEndDate(c.end_date || '');
    setStartTime(c.start_time || ''); setEndTime(c.end_time || ''); setPriority(c.priority); setStatus(c.status);
    setOrganizationId(c.organization_id);
    const res = await fetch(`/api/admin/crud/campaign_playlists?campaign_id=${c.id}`);
    const json = await res.json();
    setSelectedPlaylists((json.data ?? []).map((l: { playlist_id: string }) => l.playlist_id));
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name, description: description || null, start_date: startDate || null, end_date: endDate || null,
        start_time: startTime || null, end_time: endTime || null, priority, status,
        organization_id: organizationId, days_of_week: [1, 2, 3, 4, 5, 6, 0], updated_at: new Date().toISOString(),
      };
      let campaignId = editing?.id;
      if (editing) {
        const res = await fetch('/api/admin/crud/campaigns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        const json = await res.json();
        if (json.error) throw new Error(`Erro ao atualizar campanha: ${json.error}`);
      } else {
        const res = await fetch('/api/admin/crud/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.error) throw new Error(`Erro ao criar campanha: ${json.error}`);
        campaignId = json.data?.id;
      }
      if (campaignId) {
        const existingRes = await fetch(`/api/admin/crud/campaign_playlists?campaign_id=${campaignId}`);
        const existingJson = await existingRes.json();
        for (const cp of (existingJson.data ?? [])) {
          await fetch(`/api/admin/crud/campaign_playlists?id=${cp.id}`, { method: 'DELETE' });
        }
        const inserts = selectedPlaylists.map((pid, i) => ({ campaign_id: campaignId, playlist_id: pid, position: i + 1 }));
        for (const insert of inserts) {
          const res = await fetch('/api/admin/crud/campaign_playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(insert),
          });
          const json = await res.json();
          if (json.error) throw new Error(`Erro ao vincular playlists: ${json.error}`);
        }
      }
      resetForm(); loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const targetsRes = await fetch(`/api/admin/crud/campaign_targets?campaign_id=${deleteId}`);
      const targetsJson = await targetsRes.json();
      for (const t of (targetsJson.data ?? [])) {
        await fetch(`/api/admin/crud/campaign_targets?id=${t.id}`, { method: 'DELETE' });
      }
      const cpRes = await fetch(`/api/admin/crud/campaign_playlists?campaign_id=${deleteId}`);
      const cpJson = await cpRes.json();
      for (const cp of (cpJson.data ?? [])) {
        await fetch(`/api/admin/crud/campaign_playlists?id=${cp.id}`, { method: 'DELETE' });
      }
      await fetch(`/api/admin/crud/campaigns?id=${deleteId}`, { method: 'DELETE' });
      setDeleteId(null); loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir campanha');
    }
  }

  async function handleStatusChange(c: Campaign, newStatus: CampaignStatus) {
    await fetch('/api/admin/crud/campaigns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, status: newStatus, updated_at: new Date().toISOString() }),
    });
    loadCampaigns();
  }

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '📝' },
    active: { label: 'Ativa', color: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' },
    paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏸️' },
    ended: { label: 'Finalizada', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' },
    archived: { label: 'Arquivada', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: '📦' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} • Clique em um card para ver a programação semanal
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Nova Campanha</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Campanha' : 'Nova Campanha'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value={1}>1 — Emergência</option>
                <option value={2}>2 — Institucional</option>
                <option value={3}>3 — Comercial</option>
                <option value={4}>4 — Padrão</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
              <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">Selecione...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Playlists</label>
              {playlists.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma playlist disponível</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {playlists.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlaylists.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPlaylists([...selectedPlaylists, p.id]);
                          else setSelectedPlaylists(selectedPlaylists.filter(id => id !== p.id));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
              {selectedPlaylists.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{selectedPlaylists.length} playlist(s) selecionada(s)</p>
              )}
            </div>
            {editing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="ended">Finalizada</option>
                  <option value="archived">Arquivada</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário início</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário fim</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
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
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir esta campanha?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhuma campanha encontrada.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const sConf = statusConfig[c.status] ?? statusConfig.draft;
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{sConf.icon}</span>
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    </div>
                    {c.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{c.description}</p>
                    )}
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${sConf.color}`}>
                    {sConf.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prioridade:</span>
                    <span className="font-medium text-gray-700">{c.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Início:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fim:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.end_date)}</span>
                  </div>
                  {c.start_time && c.end_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Horário:</span>
                      <span className="font-medium text-gray-700">{c.start_time}–{c.end_time}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/campaigns/${c.id}`); }}
                    className="flex-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 text-xs font-medium"
                  >
                    📅 Programação
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                    className="flex-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 text-xs font-medium"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                    className="rounded-lg bg-red-50 hover:bg-red-100 text-red-700 py-1.5 px-2 text-xs font-medium"
                  >
                    🗑️
                  </button>
                </div>

                <div className="mt-2 text-center text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Clique para ver detalhes →
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
