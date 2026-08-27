'use client';

import { useEffect, useState, useCallback } from 'react';

interface PartnerMediaUpload {
  id: string;
  partner_access_id: string;
  media_id: string;
  organization_id: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
  partner_username: string | null;
  partner_name: string | null;
  media_name: string | null;
  media_type: string | null;
  file_url: string | null;
}

type FilterStatus = 'pending' | 'approved' | 'rejected';

export default function PartnerMediaApprovalsPage() {
  const [uploads, setUploads] = useState<PartnerMediaUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partner-media?status=${filter}`);
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch (e) {
      console.error('Failed to load partner media', e);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await fetch('/api/admin/partner-media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved' }),
      });
      loadUploads();
    } catch (e) {
      alert('Erro ao aprovar');
    }
    setProcessingId(null);
  }

  async function handleReject(id: string) {
    if (!confirm('Rejeitar esta mídia?')) return;
    setProcessingId(id);
    try {
      await fetch('/api/admin/partner-media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      });
      loadUploads();
    } catch (e) {
      alert('Erro ao rejeitar');
    }
    setProcessingId(null);
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Aprovação de Mídia Parceiro</h1>
        <button onClick={loadUploads} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : uploads.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Nenhuma mídia {statusLabels[filter].toLowerCase()} encontrada.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Pré-visualização</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Arquivo</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Parceiro</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Tamanho</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Data</th>
                  {filter === 'pending' && <th className="text-right px-5 py-3 font-medium text-gray-600">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uploads.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      {u.file_url ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          {u.media_type === 'image' || u.media_type === 'gif' ? (
                            <img src={u.file_url} alt="" className="w-full h-full object-cover" />
                          ) : u.media_type === 'video' ? (
                            <div className="w-full h-full flex items-center justify-center bg-purple-50 text-lg">🎬</div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-lg">📄</div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">?</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{u.media_name || u.file_name || '—'}</p>
                      {u.file_name && u.file_name !== u.media_name && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.file_name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-gray-900">{u.partner_name || '—'}</p>
                      <p className="text-xs text-gray-400">@{u.partner_username || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                        {u.media_type || u.file_type || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{formatSize(u.file_size)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[u.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[u.status] || u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {filter === 'pending' && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleApprove(u.id)} disabled={processingId === u.id}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                            {processingId === u.id ? '...' : '✓ Aprovar'}
                          </button>
                          <button onClick={() => handleReject(u.id)} disabled={processingId === u.id}
                            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50">
                            ✗ Rejeitar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
