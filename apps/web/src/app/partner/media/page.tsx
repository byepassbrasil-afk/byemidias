'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';

export default function PartnerMediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    try {
      const res = await fetch('/api/partner/media');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMedia(data.media ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const ct = new FormData();
        ct.append('file', file);

        const presignRes = await fetch('/api/partner/media', {
          method: 'POST',
          body: ct,
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json();
          setError(errData.error || 'Erro ao gerar upload URL');
          continue;
        }

        const { upload_url, public_url, file_name, file_size, content_type } = await presignRes.json();

        const putRes = await fetch(upload_url, {
          method: 'PUT',
          body: file,
        });

        if (!putRes.ok) {
          setError('Erro ao enviar arquivo para storage');
          continue;
        }

        await fetch('/api/partner/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name,
            mime_type: content_type,
            file_url: public_url,
            file_size,
          }),
        });
      } catch {
        setError('Erro de conexão ao enviar arquivo');
      }
    }

    setUploading(false);
    loadMedia();
  }

  async function handleDelete(mediaId: string) {
    if (!confirm('Tem certeza que deseja remover este arquivo?')) return;

    try {
      const res = await fetch(`/api/partner/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao remover');
        return;
      }
      loadMedia();
    } catch {
      setError('Erro ao remover arquivo');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
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
        <h1 className="text-2xl font-bold text-white">Minha Mídia</h1>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : '+ Enviar Arquivo'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 p-3 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/50'
        }`}
      >
        <p className="text-gray-400">Arraste arquivos aqui ou clique em &quot;Enviar Arquivo&quot;</p>
        <p className="text-xs text-gray-500 mt-1">
          Imagens (JPG, PNG, GIF, WebP) e vídeos (MP4, WebM) — máx 50MB
        </p>
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : media.length === 0 ? (
        <div className="rounded-xl bg-gray-800 p-12 text-center">
          <p className="text-gray-400">Nenhum arquivo enviado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {media.map((item) => (
            <div key={item.id} className="group relative rounded-xl bg-gray-800 border border-gray-700 overflow-hidden">
              <div className="aspect-square bg-gray-700 flex items-center justify-center">
                {item.type === 'image' || item.type === 'gif' ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <div className="text-4xl">&#127916;</div>
                ) : (
                  <div className="text-4xl">&#128196;</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.type} · {formatSize(item.file_size)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-2 right-2 rounded-lg bg-red-600/80 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Remover"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
