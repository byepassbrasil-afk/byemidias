'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';

export default function PartnerSlugMediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMedia(); }, []);

  async function loadMedia() {
    try {
      const res = await fetch('/api/partner/media');
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setMedia(data.media ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        // Step 1: get presigned URL (JSON only — no file body through Vercel)
        const presignRes = await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'presign',
            file_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
          }),
        });
        if (!presignRes.ok) { const errData = await presignRes.json().catch(() => ({})); setError(errData.error || 'Erro ao gerar upload URL'); continue; }
        const { upload_url, public_url, file_name, file_size, content_type } = await presignRes.json();
        // Step 2: upload directly to R2 (bypasses Vercel body limit)
        const putRes = await fetch(upload_url, { method: 'PUT', body: file });
        if (!putRes.ok) { setError(`Erro ao enviar arquivo para storage (HTTP ${putRes.status})`); continue; }
        // Step 3: save media record in DB
        const saveRes = await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', file_name, mime_type: content_type, file_url: public_url, file_size }),
        });
        if (!saveRes.ok) { const errData = await saveRes.json().catch(() => ({})); setError(errData.error || 'Erro ao salvar registro'); continue; }
      } catch (e: any) {
        setError(`Erro de conexão: ${e?.message || 'desconhecido'}`);
      }
    }
    setUploading(false);
    loadMedia();
  }

  async function handleDelete(mediaId: string) {
    if (!confirm('Tem certeza que deseja remover este arquivo?')) return;
    try {
      const res = await fetch(`/api/partner/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Erro ao remover'); return; }
      loadMedia();
    } catch { setError('Erro ao remover arquivo'); }
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Minha Mídia</h1>
          <p className="text-sm text-gray-500 mt-1">{media.length} arquivo{media.length !== 1 ? 's' : ''}</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={e => handleUpload(e.target.files)} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {uploading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-900/20 border border-red-800/50 p-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">×</button>
        </div>
      )}

      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        className={`mb-6 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-900/50'}`}>
        <p className="text-gray-500 text-sm">Arraste arquivos aqui ou clique em &quot;Enviar&quot;</p>
        <p className="text-xs text-gray-700 mt-1">Imagens e vídeos — máx 50MB</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhum arquivo enviado</p>
          <p className="text-sm text-gray-600 mt-1">Envie imagens ou vídeos para seus dispositivos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {media.map(item => (
            <div key={item.id} className="group relative rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors">
              <div className="aspect-square bg-gray-800 flex items-center justify-center">
                {item.type === 'image' || item.type === 'gif' ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <div className="text-4xl">🎬</div>
                ) : (
                  <div className="text-4xl">📄</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-white truncate">{item.name}</p>
                <p className="text-[10px] text-gray-600">{item.type} · {formatSize(item.file_size)}</p>
              </div>
              <button onClick={() => handleDelete(item.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-600/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
