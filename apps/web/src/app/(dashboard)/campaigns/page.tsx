'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Campaign, CampaignStatus } from '@/lib/types';

export default function CampaignsPage() {
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
  const supabase = createClient();

  useEffect(() => { loadCampaigns(); loadOrgs(); loadPlaylists(); }, []);

  async function loadCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const { data } = await supabase.from('organizations').select('id, name');
    setOrgs((data ?? []) as { id: string; name: string }[]);
  }

  async function loadPlaylists() {
    const { data } = await supabase.from('playlists').select('id, name');
    setPlaylists((data ?? []) as { id: string; name: string }[]);
  }

  function resetForm() {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setPriority(3); setStatus('draft'); setSelectedPlaylists([]); setOrganizationId(''); setEditing(null); setShowForm(false);
  }

  async function startEdit(c: Campaign) {
    setEditing(c);
    setName(c.name); setDescription(c.description || ''); setStartDate(c.start_date || ''); setEndDate(c.end_date || '');
    setStartTime(c.start_time || ''); setEndTime(c.end_time || ''); setPriority(c.priority); setStatus(c.status);
    setOrganizationId(c.organization_id);
    // Load linked playlists
    const { data: linked } = await supabase.from('campaign_playlists').select('playlist_id').eq('campaign_id', c.id);
    setSelectedPlaylists((linked ?? []).map((l: any) => l.playlist_id));
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
        const { error } = await supabase.from('campaigns').update(payload).eq('id', editing.id);
        if (error) throw new Error(`Erro ao atualizar campanha: ${error.message}`);
      } else {
        const { data, error } = await supabase.from('campaigns').insert(payload).select('id').single();
        if (error) throw new Error(`Erro ao criar campanha: ${error.message}`);
        campaignId = data?.id;
      }
      if (campaignId) {
        const { error: delErr } = await supabase.from('campaign_playlists').delete().eq('campaign_id', campaignId);
        if (delErr) throw new Error(`Erro ao limpar playlists: ${delErr.message}`);
        const inserts = selectedPlaylists.map((pid, i) => ({ campaign_id: campaignId, playlist_id: pid, position: i + 1 }));
        if (inserts.length > 0) {
          const { error: insErr } = await supabase.from('campaign_playlists').insert(inserts);
          if (insErr) throw new Error(`Erro ao vincular playlists: ${insErr.message}`);
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
      const { error: e1 } = await supabase.from('campaign_targets').delete().eq('campaign_id', deleteId);
      if (e1) throw new Error(`Erro ao limpar alvos: ${e1.message}`);
      const { error: e2 } = await supabase.from('campaign_playlists').delete().eq('campaign_id', deleteId);
      if (e2) throw new Error(`Erro ao limpar playlists: ${e2.message}`);
      const { error: e3 } = await supabase.from('campaigns').delete().eq('id', deleteId);
      if (e3) throw new Error(`Erro ao excluir campanha: ${e3.message}`);
      setDeleteId(null); loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir campanha');
    }
  }

  async function handleStatusChange(c: Campaign, newStatus: CampaignStatus) {
    await supabase.from('campaigns').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', c.id);
    loadCampaigns();
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800', active: 'bg-green-100 text-green-800', paused: 'bg-yellow-100 text-yellow-800', ended: 'bg-red-100 text-red-800', archived: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Nova Campanha</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
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
        <div className="text-gray-500">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhuma campanha encontrada.</p></div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fim</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[c.status] ?? 'bg-gray-100 text-gray-800'}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.priority}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.start_date ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.end_date ?? '—'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {c.status === 'draft' && <button onClick={() => handleStatusChange(c, 'active')} className="text-green-600 hover:text-green-800 text-sm font-medium">Ativar</button>}
                    {c.status === 'active' && <button onClick={() => handleStatusChange(c, 'paused')} className="text-yellow-600 hover:text-yellow-800 text-sm font-medium">Pausar</button>}
                    {c.status === 'paused' && <button onClick={() => handleStatusChange(c, 'active')} className="text-green-600 hover:text-green-800 text-sm font-medium">Retomar</button>}
                    <button onClick={() => startEdit(c)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                    <button onClick={() => setDeleteId(c.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
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
