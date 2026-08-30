'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';
import { convertImageToWebP, formatBytes } from '@/lib/image-convert';

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailMedia, setDetailMedia] = useState<Media | null>(null);
  const [editName, setEditName] = useState('');
  const [ttlDays, setTtlDays] = useState<number>(7); // 0 = forever, default 7 days
  const [expiresReason, setExpiresReason] = useState<string>('');
  const [showReasonDialog, setShowReasonDialog] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMedia(); loadOrgs(); }, []);

  async function loadMedia() {
    const res = await fetch('/api/admin/crud/media?order=created_at&asc=false');
    const json = await res.json();
    setMedia(json.data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const res = await fetch('/api/admin/crud/organizations?order=name&asc=true');
    const json = await res.json();
    setOrgs((json.data ?? []) as { id: string; name: string }[]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;
    if (!organizationId) { alert('Selecione uma organização primeiro.'); return; }

    // If "Manter para sempre", require user to confirm and provide reason
    if (ttlDays === 0) {
      const reason = prompt(
        '⚠️ MANTER PARA SEMPRE\n\n' +
        'Este arquivo NÃO será deletado automaticamente.\n' +
        'Você é responsável por gerenciá-lo manualmente.\n\n' +
        'JUSTIFIQUE POR QUE este arquivo deve ficar permanentemente (mínimo 10 caracteres):'
      );
      if (reason === null) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (reason.trim().length < 10) {
        alert('É necessário justificar com pelo menos 10 caracteres.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setExpiresReason(reason.trim());
    } else {
      setExpiresReason('');
    }

    setUploading(true);
    try {
      // Convert images (PNG/JPEG/etc) to WebP for ~30-50% smaller files
      const file = await convertImageToWebP(originalFile, 0.85);
      if (file !== originalFile) {
        const reduction = Math.round((1 - file.size / originalFile.size) * 100);
        console.log(`Convertido ${originalFile.name}: ${formatBytes(originalFile.size)} → ${formatBytes(file.size)} (-${reduction}%)`);
      }

      const presignRes = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          organization_id: organizationId,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        alert('Erro ao preparar upload: ' + (presignData.error || 'Erro'));
        setUploading(false);
        return;
      }

      const uploadRes = await fetch(presignData.upload_url, {
        method: 'PUT',
        body: file,
      });

      if (!uploadRes.ok) {
        alert('Erro ao enviar arquivo para o storage');
        setUploading(false);
        return;
      }

      const saveRes = await fetch('/api/admin/media/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type,
          file_url: presignData.public_url,
          file_size: file.size,
          organization_id: organizationId,
          ttl_days: ttlDays,
          expires_reason: ttlDays === 0 ? expiresReason : undefined,
        }),
      });

      if (saveRes.ok) {
        const ttlLabel = ttlDays === 0 ? 'para sempre' : `por ${ttlDays} dias`;
        alert(`Upload concluído! Arquivo será mantido ${ttlLabel}.`);
        loadMedia();
      } else {
        const err = await saveRes.json();
        alert('Erro ao salvar: ' + (err.error || 'Erro'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('Erro ao enviar arquivo: ' + msg);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/crud/media?id=${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    setDetailMedia(null);
    loadMedia();
  }

  async function handleRename() {
    if (!detailMedia || !editName.trim()) return;
    await fetch('/api/admin/crud/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailMedia.id, name: editName.trim() }),
    });
    setDetailMedia({ ...detailMedia, name: editName.trim() });
    loadMedia();
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Mídia</h1>
        <div className="flex items-center gap-3">
          <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
            <option value="">Organização...</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
<select value={ttlDays} onChange={(e) => setTtlDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            title="Manter arquivo por quanto tempo (default: 1 semana)">
            <option value={7}>1 semana (padrão)</option>
            <option value={21}>3 semanas</option>
            <option value={30}>1 mês</option>
            <option value={90}>3 meses</option>
            <option value={0}>Manter para sempre ⚠️</option>
          </select>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || !organizationId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'Enviando...' : '+ Upload'}
          </button>
        </div>
      </div>

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-50 p-6 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir esta mídia? O arquivo também será removido do storage.</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : media.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhuma mídia encontrada.</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {media.map((item) => (
            <div key={item.id} onClick={() => { setDetailMedia(item); setEditName(item.name); }}
              className="group relative rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all">
              <button onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }} className="absolute top-2 right-2 z-10 rounded-full bg-red-600 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700" title="Excluir">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {item.type === 'image' || item.type === 'gif' ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <div className="text-4xl">🎬</div>
                ) : (
                  <div className="text-4xl">📄</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.type} · {formatSize(item.file_size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {detailMedia && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetailMedia(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Detalhes da Midia</h2>
                <button onClick={() => setDetailMedia(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="flex gap-6">
                <div className="w-48 h-48 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {detailMedia.type === 'image' || detailMedia.type === 'gif' ? (
                    <img src={detailMedia.file_url} alt={detailMedia.name} className="w-full h-full object-cover" />
                  ) : detailMedia.type === 'video' ? (
                    <video src={detailMedia.file_url} className="w-full h-full object-cover" controls />
                  ) : (
                    <div className="text-5xl">📄</div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome</label>
                    <div className="flex gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                      <button onClick={handleRename}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Renomear</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Tipo:</span>
                      <span className="ml-2 text-gray-900 font-medium">{detailMedia.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tamanho:</span>
                      <span className="ml-2 text-gray-900">{formatSize(detailMedia.file_size)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className="ml-2 text-gray-900">{detailMedia.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID:</span>
                      <span className="ml-2 text-gray-900 font-mono text-xs">{detailMedia.id?.slice(0, 8)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">URL</label>
                    <input value={detailMedia.file_url || ''} readOnly
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 font-mono" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <a href={detailMedia.file_url} target="_blank" rel="noopener"
                      className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-300">Abrir URL</a>
                    <button onClick={() => { setDeleteId(detailMedia.id); setDetailMedia(null); }}
                      className="rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-200">Excluir</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
