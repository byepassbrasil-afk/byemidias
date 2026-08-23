'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Media } from '@/lib/types';

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailMedia, setDetailMedia] = useState<Media | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => { loadMedia(); loadOrgs(); }, []);

  async function loadMedia() {
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setMedia(data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const { data } = await supabase.from('organizations').select('id, name');
    setOrgs((data ?? []) as { id: string; name: string }[]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!organizationId) { alert('Selecione uma organização primeiro.'); return; }

    setUploading(true);
    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `uploads/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      alert('Erro ao enviar arquivo: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'image';

    await supabase.from('media').insert({
      organization_id: organizationId,
      name: file.name,
      type: mediaType,
      file_url: urlData.publicUrl,
      file_size: file.size,
      status: 'active',
    });

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadMedia();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const item = media.find((m) => m.id === deleteId);
    if (item?.file_url) {
      const path = item.file_url.split('/media/')[1];
      if (path) await supabase.storage.from('media').remove([path]);
    }
    await supabase.from('media').delete().eq('id', deleteId);
    setDeleteId(null);
    setDetailMedia(null);
    loadMedia();
  }

  async function handleRename() {
    if (!detailMedia || !editName.trim()) return;
    await supabase.from('media').update({ name: editName.trim() }).eq('id', detailMedia.id);
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
