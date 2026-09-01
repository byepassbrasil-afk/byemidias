'use client';

import { useEffect, useState } from 'react';

interface PlaylistItem {
  id: string;
  media_id: string;
  position: number;
  duration: number | null;
  transition: string | null;
  media?: {
    id: string;
    name: string;
    type: string;
    file_url: string;
  } | null;
}

interface PendingPlaylist {
  id: string;
  name: string;
  description: string | null;
  version: number;
  approval_status: string;
  requested_by: string | null;
  requested_at: string | null;
  parent_id: string | null;
  parent?: {
    id: string;
    name: string;
    version: number;
  } | null;
  items: PlaylistItem[];
  original_items: PlaylistItem[];
}

export default function ApprovalsPage() {
  const [playlists, setPlaylists] = useState<PendingPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    try {
      const res = await fetch('/api/admin/playlists/pending');
      const data = await res.json();
      setPlaylists(data.playlists ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleApprove(playlistId: string) {
    setProcessingId(playlistId);
    try {
      const res = await fetch(`/api/admin/playlists/${playlistId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        loadPending();
      } else {
        const data = await res.json();
        alert('Erro: ' + data.error);
      }
    } catch {
      alert('Erro ao aprovar playlist');
    }
    setProcessingId(null);
  }

  async function handleReject(playlistId: string) {
    setProcessingId(playlistId);
    try {
      const res = await fetch(`/api/admin/playlists/${playlistId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || null }),
      });

      if (res.ok) {
        setShowRejectModal(null);
        setRejectReason('');
        loadPending();
      } else {
        const data = await res.json();
        alert('Erro: ' + data.error);
      }
    } catch {
      alert('Erro ao rejeitar playlist');
    }
    setProcessingId(null);
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aprovações Pendentes</h1>
        <button onClick={loadPending} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : playlists.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Nenhuma aprovação pendente.</p>
          <p className="text-sm text-gray-400 mt-1">Quando parceiros modificarem playlists, as alterações aparecerão aqui para aprovação.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {playlists.map((pl) => (
            <div key={pl.id} className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">{pl.name}</h2>
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                        v{pl.version} — Pendente
                      </span>
                    </div>
                    {pl.parent && (
                      <p className="text-sm text-gray-500 mt-1">
                        Versão anterior: {pl.parent.name} (v{pl.parent.version})
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      Solicitado por: {pl.requested_by || 'Desconhecido'} em {pl.requested_at ? new Date(pl.requested_at).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(pl.id)}
                      disabled={processingId === pl.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === pl.id ? 'Processando...' : '✓ Aprovar'}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(pl.id)}
                      disabled={processingId === pl.id}
                      className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      ✗ Rejeitar
                    </button>
                  </div>
                </div>
              </div>

              {/* Items comparison */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Original items */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Versão Atual (Rodando)</h3>
                    {pl.original_items.length === 0 ? (
                      <p className="text-sm text-gray-400">Playlist vazia</p>
                    ) : (
                      <div className="space-y-2">
                        {pl.original_items.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                            <span className="text-xs text-gray-400 w-6">{idx + 1}.</span>
                            {item.media?.type === 'image' || item.media?.type === 'gif' ? (
                              <img src={item.media?.file_url} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : item.media?.type === 'video' ? (
                              <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center text-sm">🎬</div>
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-sm">📄</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.media?.name ?? item.media_id}</p>
                              <p className="text-xs text-gray-500">{formatDuration(item.duration)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* New items */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Nova Versão (Proposta)</h3>
                    {pl.items.length === 0 ? (
                      <p className="text-sm text-gray-400">Playlist vazia</p>
                    ) : (
                      <div className="space-y-2">
                        {pl.items.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="text-xs text-amber-600 w-6">{idx + 1}.</span>
                            {item.media?.type === 'image' || item.media?.type === 'gif' ? (
                              <img src={item.media?.file_url} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : item.media?.type === 'video' ? (
                              <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center text-sm">🎬</div>
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-sm">📄</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.media?.name ?? item.media_id}</p>
                              <p className="text-xs text-gray-500">{formatDuration(item.duration)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rejeitar Playlist</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Motivo da rejeição..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={processingId === showRejectModal}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processingId === showRejectModal ? 'Rejeitando...' : 'Rejeitar'}
              </button>
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
