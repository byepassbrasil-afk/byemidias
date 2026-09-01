'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { Campaign, CampaignStatus } from '@/lib/types';

interface CampaignInfo {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: number;
  organization_id: string;
}

interface CampaignPlaylistLink {
  id: string;
  campaign_id: string;
  playlist_id: string;
  position: number;
  playlists?: { id: string; name: string } | null;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  priority: number;
  status: string;
  playlist_id: string | null;
  playlists?: { id: string; name: string } | null;
}

interface Playlist {
  id: string;
  name: string;
  organization_id?: string;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}

function fmtTimeOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 5);
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [campaignLinks, setCampaignLinks] = useState<CampaignPlaylistLink[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<Partial<TimeSlot> | null>(null);
  const [addingNew, setAddingNew] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/crud/campaigns?id=${id}`);
      const json = await res.json();
      if (json.data?.[0]) setCampaign(json.data[0]);
      const [slotsRes, linksRes, plRes] = await Promise.all([
        fetch(`/api/admin/crud/campaign_time_slots?campaign_id=${id}`),
        fetch(`/api/admin/crud/campaign_playlists?campaign_id=${id}`),
        fetch('/api/admin/crud/playlists?order=name'),
      ]);
      const slotsJson = await slotsRes.json();
      setTimeSlots((slotsJson.data ?? []).map((s: TimeSlot) => s));
      const linksJson = await linksRes.json();
      setCampaignLinks((linksJson.data ?? []) as CampaignPlaylistLink[]);
      const plJson = await plRes.json();
      setAllPlaylists((plJson.data ?? []) as Playlist[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-redirect to list page when ?edit=1, opening the modal via parent state
  // (we handle modal in list page now)

  async function changeStatus(newStatus: CampaignStatus) {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/crud/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, updated_at: new Date().toISOString() }),
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

  async function startEditSlot(slot: TimeSlot | null, day: number) {
    if (slot) {
      setEditingSlot({ ...slot });
    } else {
      setEditingSlot({
        day_of_week: day,
        start_time: '08:00',
        end_time: '18:00',
        priority: 3,
        status: 'active',
        playlist_id: null,
      });
      setAddingNew(day);
    }
  }

  async function saveSlot() {
    if (!editingSlot || !campaign) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        campaign_id: campaign.id,
        day_of_week: editingSlot.day_of_week,
        start_time: editingSlot.start_time,
        end_time: editingSlot.end_time,
        priority: editingSlot.priority ?? 3,
        status: editingSlot.status ?? 'active',
        playlist_id: editingSlot.playlist_id || null,
      };
      let res: Response;
      if (editingSlot.id && !addingNew) {
        res = await fetch('/api/admin/crud/campaign_time_slots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingSlot.id, ...payload }),
        });
      } else {
        res = await fetch('/api/admin/crud/campaign_time_slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setEditingSlot(null);
      setAddingNew(null);
      setSuccessMsg('Horário salvo');
      setTimeout(() => setSuccessMsg(null), 2000);
      load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(id: string) {
    if (!confirm('Excluir este horário?')) return;
    try {
      await fetch(`/api/admin/crud/campaign_time_slots?id=${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setErrorMsg(e?.message);
    }
  }

  async function toggleSlotStatus(slot: TimeSlot) {
    const newStatus = slot.status === 'active' ? 'inactive' : 'active';
    try {
      await fetch('/api/admin/crud/campaign_time_slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slot.id, status: newStatus }),
      });
      load();
    } catch (e: any) {
      setErrorMsg(e?.message);
    }
  }

  function slotsForDay(day: number): TimeSlot[] {
    return timeSlots.filter(s => s.day_of_week === day).sort((a, b) => {
      const aTime = (a.start_time || '').slice(0, 5);
      const bTime = (b.start_time || '').slice(0, 5);
      return aTime.localeCompare(bTime);
    });
  }

  function statusBadge(status: string) {
    return status === 'active'
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-gray-100 text-gray-500 border-gray-300';
  }

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Carregando...</div>;
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Campanha não encontrada.</p>
        <button onClick={() => router.push('/dashboard/campaigns')} className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700">← Voltar</button>
      </div>
    );
  }

  const statusLabel = {
    draft: '📝 Rascunho',
    active: '🟢 Ativa',
    paused: '⏸ Pausada',
    ended: '🔴 Finalizada',
    archived: '📦 Arquivada',
  }[campaign.status] || campaign.status;

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">Erro: {errorMsg}</div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/dashboard/campaigns')} className="text-sm text-blue-600 hover:text-blue-800 mb-2">← Campanhas</button>
          <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
          {campaign.description && <p className="text-gray-500 mt-1">{campaign.description}</p>}
        </div>
        <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
          campaign.status === 'active' ? 'bg-green-100 text-green-800 border-green-300' :
          campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
          campaign.status === 'ended' ? 'bg-red-100 text-red-800 border-red-300' :
          campaign.status === 'archived' ? 'bg-gray-200 text-gray-700 border-gray-300' :
          'bg-gray-100 text-gray-800 border-gray-300'
        }">
          {statusLabel}
        </span>
      </div>

      {/* Status action buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {campaign.status !== 'active' && campaign.status !== 'archived' && campaign.status !== 'ended' && (
            <button
              onClick={() => changeStatus('active')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200"
            >
              ▶ Ativar
            </button>
          )}
          {campaign.status === 'active' && (
            <button
              onClick={() => changeStatus('paused')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            >
              ⏸ Pausar
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => changeStatus('active')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200"
            >
              ▶ Retomar
            </button>
          )}
          {campaign.status === 'active' && (
            <button
              onClick={() => changeStatus('ended')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200"
            >
              ⏹ Finalizar
            </button>
          )}
          {campaign.status !== 'archived' && (
            <button
              onClick={() => changeStatus('archived')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              📦 Arquivar
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/campaigns')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
          >
            ← Voltar à lista
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Início</p>
          <p className="text-lg font-semibold text-gray-900">{fmtDate(campaign.start_date)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Fim</p>
          <p className="text-lg font-semibold text-gray-900">{fmtDate(campaign.end_date)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Horário base</p>
          <p className="text-lg font-semibold text-gray-900">
            {fmtTimeOnly(campaign.start_time)}–{fmtTimeOnly(campaign.end_time)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Prioridade</p>
          <p className="text-lg font-semibold text-gray-900">{campaign.priority}</p>
        </div>
      </div>

      {/* Playlists vinculadas */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📋 Playlists Vinculadas</h2>
        {campaignLinks.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma playlist vinculada. Edite a campanha para vincular.</p>
        ) : (
          <div className="space-y-2">
            {campaignLinks.sort((a, b) => a.position - b.position).map((l, i) => (
              <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-8">#{i + 1}</span>
                  <span className="text-sm">{l.playlists?.name || `Playlist ${l.playlist_id.slice(0, 8)}`}</span>
                </div>
                <span className="text-xs text-gray-500">Pos: {l.position}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Schedule */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">🗓️ Programação Semanal</h2>
            <p className="text-xs text-gray-500">Defina em quais dias e horários cada playlist é exibida.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const slots = slotsForDay(day);
            return (
              <div key={day} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">{DAY_NAMES[day]}</h3>
                  <button
                    onClick={() => startEditSlot(null, day)}
                    className="rounded bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5"
                    title="Adicionar horário"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-2">
                  {slots.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-2">Sem horários</p>
                  )}
                  {slots.map((slot) => (
                    <div key={slot.id} className={`rounded-md p-2 border text-xs ${statusBadge(slot.status)}`}>
                      <div className="font-medium">
                        {fmtTimeOnly(slot.start_time)} – {fmtTimeOnly(slot.end_time)}
                      </div>
                      <div className="text-gray-600 mt-1 truncate">
                        {slot.playlists?.name || 'Sem playlist'}
                      </div>
                      <div className="text-gray-500 mt-0.5">Prior: {slot.priority}</div>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => startEditSlot(slot, day)}
                          className="flex-1 rounded bg-white hover:bg-gray-50 px-1 py-0.5 text-gray-700 border border-gray-200"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleSlotStatus(slot)}
                          className="flex-1 rounded bg-white hover:bg-gray-50 px-1 py-0.5 text-gray-700 border border-gray-200"
                        >
                          {slot.status === 'active' ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="rounded bg-red-50 hover:bg-red-100 px-1.5 py-0.5 text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setEditingSlot(null); setAddingNew(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {addingNew !== null ? 'Novo Horário' : 'Editar Horário'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Dia da semana</label>
                <select
                  value={editingSlot.day_of_week}
                  onChange={(e) => setEditingSlot({ ...editingSlot, day_of_week: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {DAY_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Início</label>
                  <input
                    type="time"
                    value={editingSlot.start_time}
                    onChange={(e) => setEditingSlot({ ...editingSlot, start_time: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Fim</label>
                  <input
                    type="time"
                    value={editingSlot.end_time}
                    onChange={(e) => setEditingSlot({ ...editingSlot, end_time: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Playlist</label>
                <select
                  value={editingSlot.playlist_id || ''}
                  onChange={(e) => setEditingSlot({ ...editingSlot, playlist_id: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sem playlist</option>
                  {allPlaylists.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Prioridade</label>
                <input
                  type="number"
                  value={editingSlot.priority ?? 3}
                  onChange={(e) => setEditingSlot({ ...editingSlot, priority: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Status</label>
                <select
                  value={editingSlot.status ?? 'active'}
                  onChange={(e) => setEditingSlot({ ...editingSlot, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setEditingSlot(null); setAddingNew(null); }}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={saveSlot}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
