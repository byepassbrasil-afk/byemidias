'use client';

import { useEffect, useState } from 'react';

interface Override {
  media_id: string;
  media_name: string;
  media_url: string | null;
  force_show: boolean;
  reason: string;
  by_user: string | null;
  at: string | null;
}

interface MediaSearchItem {
  id: string;
  name: string;
  file_url: string;
}

interface OverridesSectionProps {
  deviceId: string;
}

export default function OverridesSection({ deviceId }: OverridesSectionProps) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaResults, setMediaResults] = useState<MediaSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaSearchItem | null>(null);
  const [forceShow, setForceShow] = useState(true);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/dashboard/devices/${deviceId}/overrides`);
      const d = await r.json();
      setOverrides(d.overrides ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [deviceId]);

  async function searchMedia() {
    if (mediaSearch.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/crud/media?order=name&asc=true`);
      const d = await r.json();
      const all = (d.data ?? []) as MediaSearchItem[];
      const filtered = all.filter(m => m.name.toLowerCase().includes(mediaSearch.toLowerCase()));
      setMediaResults(filtered.slice(0, 10));
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  }

  function resetAdd() {
    setShowAdd(false);
    setSelectedMedia(null);
    setReason('');
    setForceShow(true);
    setMediaSearch('');
    setMediaResults([]);
    setError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMedia) return;
    if (reason.trim().length < 5) {
      setError('Motivo deve ter pelo menos 5 caracteres');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/devices/${deviceId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: selectedMedia.id,
          force_show: forceShow,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Erro ao salvar');
        setSaving(false);
        return;
      }
      setMessage('✓ Override criado!');
      setTimeout(() => setMessage(null), 3000);
      resetAdd();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
    setSaving(false);
  }

  async function handleRemove(mediaId: string) {
    if (!confirm('Remover este override?')) return;
    await fetch(`/api/dashboard/devices/${deviceId}/overrides/${mediaId}`, { method: 'DELETE' });
    setMessage('✓ Override removido!');
    setTimeout(() => setMessage(null), 3000);
    await load();
  }

  return (
    <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">🔓 Overrides Manuais</h2>
          <p className="text-xs text-gray-500 mt-1">Forçar ou bloquear mídias específicas neste dispositivo</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-xs rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-white font-medium">
          {showAdd ? 'Cancelar' : '+ Adicionar override'}
        </button>
      </div>

      {message && (
        <div className="mb-3 rounded-lg bg-green-900/30 border border-green-700/50 p-2 text-sm text-green-300">{message}</div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
          {error && <div className="rounded bg-red-900/30 border border-red-700/50 p-2 text-sm text-red-300">{error}</div>}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Buscar mídia</label>
            <div className="flex gap-2">
              <input
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchMedia(); } }}
                placeholder="Nome da mídia..."
                className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
              />
              <button type="button" onClick={searchMedia} disabled={searching}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                {searching ? '...' : '🔍'}
              </button>
            </div>
            {mediaResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900">
                {mediaResults.map(m => (
                  <button key={m.id} type="button" onClick={() => setSelectedMedia(m)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-800 ${selectedMedia?.id === m.id ? 'bg-orange-900/30' : ''}`}>
                    {m.file_url && <img src={m.file_url} alt="" className="w-8 h-8 object-cover rounded" />}
                    <span className="text-white flex-1 truncate">{m.name}</span>
                    {selectedMedia?.id === m.id && <span className="text-orange-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMedia && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ação</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForceShow(true)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${forceShow ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    🔓 Forçar mostrar
                  </button>
                  <button type="button" onClick={() => setForceShow(false)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${!forceShow ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    🔒 Bloquear
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Motivo *</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Promoção especial, parceiro aprovou manualmente..."
                  required
                  className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 5 caracteres</p>
              </div>

              <button type="submit" disabled={saving}
                className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar override'}
              </button>
            </>
          )}
        </form>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : overrides.length === 0 ? (
        <div className="text-xs text-gray-500 italic text-center py-4">
          Nenhum override. Mídias passam pelo filtro padrão de categoria.
        </div>
      ) : (
        <div className="space-y-2">
          {overrides.map((o) => (
            <div key={o.media_id} className={`flex items-start gap-3 rounded-xl p-3 border ${o.force_show ? 'bg-green-900/10 border-green-700/30' : 'bg-red-900/10 border-red-700/30'}`}>
              {o.media_url && <img src={o.media_url} alt="" className="w-12 h-12 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${o.force_show ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {o.force_show ? '🔓 FORÇADO' : '🔒 BLOQUEADO'}
                  </span>
                  <span className="text-sm font-medium text-white truncate">{o.media_name}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">📝 {o.reason}</p>
                {o.at && <p className="text-xs text-gray-500 mt-0.5">📅 {new Date(o.at).toLocaleString('pt-BR')}</p>}
              </div>
              <button onClick={() => handleRemove(o.media_id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20">
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
