'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Campaign, CampaignStatus } from '@/lib/types';

interface CampaignPlaylistLink {
  id: string;
  campaign_id: string;
  playlist_id: string;
  position: number;
  playlists?: { id: string; name: string } | null;
}

interface Playlist {
  id: string;
  name: string;
  organization_id?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '📝' },
  active: { label: 'Ativa', color: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' },
  paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏸️' },
  ended: { label: 'Finalizada', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' },
  archived: { label: 'Arquivada', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: '📦' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch { return iso; }
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [links, setLinks] = useState<CampaignPlaylistLink[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [campRes, linkRes, playlistRes] = await Promise.all([
        fetch('/api/admin/crud/campaigns?order=created_at&asc=false'),
        fetch('/api/admin/crud/campaign_playlists?order=position'),
        fetch('/api/admin/crud/playlists?order=name'),
      ]);
      const campJson = await campRes.json();
      const linkJson = await linkRes.json();
      const playlistJson = await playlistRes.json();
      setCampaigns(campJson.data ?? []);
      setLinks((linkJson.data ?? []) as CampaignPlaylistLink[]);
      setPlaylists((playlistJson.data ?? []) as Playlist[]);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro de conexão');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(c: Campaign, newStatus: CampaignStatus) {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/crud/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: newStatus, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err && (err.error || JSON.stringify(err))) || `HTTP ${res.status}`);
      }
      setSuccessMsg(`Status alterado para ${newStatus}`);
      setTimeout(() => setSuccessMsg(null), 2000);
      load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao alterar status');
    }
  }

  function linksForCampaign(campaignId: string): CampaignPlaylistLink[] {
    return links
      .filter(l => l.campaign_id === campaignId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">Erro: {errorMsg}</div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} • Clique em um card para ver a programação semanal
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setCreating(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Nenhuma campanha encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const sConf = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
            const campaignLinks = linksForCampaign(c.id);
            const isExpanded = expandedId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{sConf.icon}</span>
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${sConf.color}`}>
                    {sConf.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Início:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fim:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.end_date)}</span>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.status !== 'active' && c.status !== 'archived' && (
                    <button
                      onClick={() => changeStatus(c, 'active')}
                      className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 hover:bg-green-200"
                      title="Ativar"
                    >
                      ▶ Ativar
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button
                      onClick={() => changeStatus(c, 'paused')}
                      className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                      title="Pausar"
                    >
                      ⏸ Pausar
                    </button>
                  )}
                  {c.status === 'paused' && (
                    <button
                      onClick={() => changeStatus(c, 'active')}
                      className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 hover:bg-green-200"
                      title="Retomar"
                    >
                      ▶ Retomar
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button
                      onClick={() => changeStatus(c, 'ended')}
                      className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 hover:bg-red-200"
                      title="Finalizar"
                    >
                      ⏹ Finalizar
                    </button>
                  )}
                  {c.status !== 'archived' && (
                    <button
                      onClick={() => changeStatus(c, 'archived')}
                      className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700 hover:bg-gray-300"
                      title="Arquivar"
                    >
                      📦 Arquivar
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      📋 Playlists Vinculadas
                    </h4>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? '▲ Ocultar' : `▶ Ver (${campaignLinks.length})`}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="bg-gray-50 rounded-md p-2 space-y-1.5">
                      {campaignLinks.length === 0 ? (
                        <p className="text-xs text-gray-500 italic px-1 py-1">Nenhuma playlist vinculada</p>
                      ) : (
                        campaignLinks.map((l, i) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-gray-200"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-gray-400 w-6 text-right">
                                #{i + 1}
                              </span>
                              <span className="text-sm text-gray-900 truncate">
                                {l.playlists?.name || 'Playlist'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">Pos: {l.position}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
                  <button
                    onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                    className="flex-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 text-xs font-medium"
                  >
                    📅 Programação
                  </button>
                  <button
                    onClick={() => { setCreating(false); setEditing(c); }}
                    className="flex-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 text-xs font-medium"
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <CampaignFormModal
          editing={editing}
          playlists={playlists}
          saving={saving}
          setSaving={setSaving}
          onClose={() => { setCreating(false); setEditing(null); setErrorMsg(null); }}
          onSaved={(camp) => {
            setCreating(false);
            setEditing(null);
            setSuccessMsg(camp.id === editing?.id ? 'Campanha atualizada' : 'Campanha criada');
            setTimeout(() => setSuccessMsg(null), 2000);
            load();
          }}
          onError={(e) => setErrorMsg(e)}
        />
      )}
    </div>
  );
}

function CampaignFormModal({
  editing,
  playlists,
  saving,
  setSaving,
  onClose,
  onSaved,
  onError,
}: {
  editing: Campaign | null;
  playlists: Playlist[];
  saving: boolean;
  setSaving: (b: boolean) => void;
  onClose: () => void;
  onSaved: (camp: Campaign) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    description: editing?.description ?? '',
    start_date: editing?.start_date ?? '',
    end_date: editing?.end_date ?? '',
    start_time: editing?.start_time ?? '',
    end_time: editing?.end_time ?? '',
    priority: editing?.priority ?? 3,
    status: editing?.status ?? 'draft',
    playlist_ids: [] as string[],
  });
  const [playlistSearch, setPlaylistSearch] = useState('');

  useEffect(() => {
    if (editing) {
      fetch(`/api/admin/crud/campaign_playlists?campaign_id=${editing.id}`)
        .then(r => r.json())
        .then(j => {
          setForm(f => ({
            ...f,
            playlist_ids: (j.data ?? []).map((l: any) => l.playlist_id).filter(Boolean),
          }));
        })
        .catch(() => {});
    }
  }, [editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError('');

    const payload: any = {
      name: form.name,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      priority: form.priority,
      status: form.status,
    };

    const doSave = async () => {
      let res: Response;
      if (editing) {
        payload.id = editing.id;
        payload.updated_at = new Date().toISOString();
        res = await fetch('/api/admin/crud/campaigns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/crud/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, days_of_week: [1,2,3,4,5,6,0] }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error((json && (json.error || JSON.stringify(json))) || `HTTP ${res.status}`);
      const campId = editing?.id ?? (json.data?.[0]?.id ?? json.data?.id);
      if (!campId) throw new Error('Não foi possível identificar a campanha criada');

      // Replace playlist links
      await fetch(`/api/admin/crud/campaign_playlists?campaign_id=${campId}`, { method: 'DELETE' });
      for (let i = 0; i < form.playlist_ids.length; i++) {
        await fetch('/api/admin/crud/campaign_playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campId, playlist_id: form.playlist_ids[i], position: i + 1 }),
        });
      }
      onSaved({ ...form, id: campId } as unknown as Campaign);
    };

    doSave()
      .catch((e: any) => onError(e?.message || 'Erro ao salvar'))
      .finally(() => setSaving(false));
  }

  const filteredPlaylists = playlists.filter(p =>
    !playlistSearch ||
    p.name.toLowerCase().includes(playlistSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              {editing ? `Editar Campanha` : 'Nova Campanha'}
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário início</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário fim</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                <option value={1}>1 — Emergência</option>
                <option value={2}>2 — Institucional</option>
                <option value={3}>3 — Comercial</option>
                <option value={4}>4 — Padrão</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="ended">Finalizada</option>
                <option value="archived">Arquivada</option>
              </select>
            </div>
          </div>

          {/* Playlists selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Playlists (em ordem de reprodução)</label>
            <input
              type="text"
              value={playlistSearch}
              onChange={(e) => setPlaylistSearch(e.target.value)}
              placeholder="Filtrar playlists..."
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm mb-2"
            />
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {filteredPlaylists.map((p) => {
                const checked = form.playlist_ids.includes(p.id);
                const idx = checked ? form.playlist_ids.indexOf(p.id) : -1;
                return (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm(f => ({ ...f, playlist_ids: [...f.playlist_ids, p.id] }));
                        } else {
                          setForm(f => ({ ...f, playlist_ids: f.playlist_ids.filter(id => id !== p.id) }));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="flex-1 text-sm">{p.name}</span>
                    {checked && idx >= 0 && (
                      <span className="text-xs text-blue-600">#{idx + 1}</span>
                    )}
                  </label>
                );
              })}
              {filteredPlaylists.length === 0 && (
                <p className="text-xs text-gray-500 italic px-3 py-2">Nenhuma playlist encontrada</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Selecionadas: {form.playlist_ids.length}. Ordem de reprodução = ordem de seleção.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : (editing ? 'Atualizar' : 'Criar Campanha')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
