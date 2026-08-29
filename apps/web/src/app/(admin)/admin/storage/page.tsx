'use client';

import { useEffect, useState, useCallback } from 'react';

interface R2Object {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

interface R2Folder {
  prefix: string;
  name: string;
}

interface ListResult {
  objects: R2Object[];
  folders: R2Folder[];
  totalSize: number;
}

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-1fc1e39765fd4278b118feb04d4f44fe.r2.dev';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function publicUrlFor(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

function basename(key: string): string {
  const parts = key.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? key;
}

function isImage(key: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)$/i.test(key);
}

function isVideo(key: string): boolean {
  return /\.(mp4|webm|mov|avi|wmv|mkv)$/i.test(key);
}

export default function AdminStoragePage() {
  const [prefix, setPrefix] = useState('');
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadFolder = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setRenaming(null);
    try {
      const res = await fetch(`/api/admin/storage?prefix=${encodeURIComponent(p)}`);
      if (!res.ok) { const err = await res.json().catch(() => ({})); setError(err.error || `HTTP ${res.status}`); setData(null); setLoading(false); return; }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Erro de conexão');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFolder(prefix); }, [prefix, loadFolder]);

  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  function enterFolder(folderPrefix: string) {
    setPrefix(folderPrefix);
  }

  function goUp() {
    const parts = prefix.split('/').filter(Boolean);
    parts.pop();
    setPrefix(parts.join('/'));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} arquivo(s)? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch('/api/admin/storage/any', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) { alert(`Erro: ${json.error || res.statusText}`); return; }
      if (json.errors?.length) alert(`Alguns erros: ${json.errors.join(', ')}`);
      loadFolder(prefix);
    } catch (e: any) {
      alert(`Erro de conexão: ${e?.message}`);
    }
  }

  async function deleteOne(key: string) {
    if (!confirm(`Excluir "${basename(key)}"?`)) return;
    try {
      const res = await fetch('/api/admin/storage/any', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(`Erro: ${j.error || res.statusText}`); return; }
      loadFolder(prefix);
    } catch (e: any) {
      alert(`Erro: ${e?.message}`);
    }
  }

  async function commitRename(sourceKey: string) {
    const newName = renameValue.trim();
    if (!newName || newName === basename(sourceKey)) { setRenaming(null); return; }
    // Replace just the filename portion, keep the prefix
    const dir = sourceKey.substring(0, sourceKey.lastIndexOf('/') + 1);
    const destKey = dir + newName;
    try {
      const res = await fetch('/api/admin/storage/any', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_key: sourceKey, dest_key: destKey }),
      });
      const json = await res.json();
      if (!res.ok) { alert(`Erro: ${json.error || res.statusText}`); return; }
      setRenaming(null);
      loadFolder(prefix);
    } catch (e: any) {
      alert(`Erro: ${e?.message}`);
    }
  }

  function startRename(key: string) {
    setRenaming(key);
    setRenameValue(basename(key));
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    if (!data) return;
    if (selected.size === data.objects.length) setSelected(new Set());
    else setSelected(new Set(data.objects.map(o => o.key)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Storage R2</h1>
          <p className="text-sm text-gray-500">Gerenciador de arquivos do Cloudflare R2</p>
        </div>
        {data && (
          <div className="text-xs text-gray-500">
            <span className="text-white font-semibold">{data.objects.length}</span> arquivos · <span className="text-white font-semibold">{data.folders.length}</span> pastas · <span className="text-white font-semibold">{formatBytes(data.totalSize)}</span>
          </div>
        )}
      </div>

      {/* Breadcrumb + actions bar */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm flex-1 min-w-0 overflow-x-auto">
          <button onClick={() => setPrefix('')} className={`px-2 py-1 rounded ${prefix === '' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            📁 byemidias
          </button>
          {breadcrumbs.map((seg, i) => {
            const segPath = breadcrumbs.slice(0, i + 1).join('/');
            return (
              <span key={segPath} className="flex items-center gap-2">
                <span className="text-gray-600">/</span>
                <button onClick={() => setPrefix(segPath)} className={`px-2 py-1 rounded ${prefix === segPath ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  {seg}
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selected.size > 0 && (
            <button onClick={deleteSelected} className="px-3 py-1.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-500">
              🗑️ Excluir ({selected.size})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-800/50 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : !data ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400">Sem dados</p>
        </div>
      ) : (data.folders.length === 0 && data.objects.length === 0) ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400">Pasta vazia</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800 text-xs text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3 w-10">
                  {data.objects.length > 0 && (
                    <input type="checkbox" checked={selected.size === data.objects.length && data.objects.length > 0} onChange={selectAll} className="rounded" />
                  )}
                </th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left w-24">Tipo</th>
                <th className="px-4 py-3 text-right w-24">Tamanho</th>
                <th className="px-4 py-3 text-left w-44">Modificado</th>
                <th className="px-4 py-3 text-right w-40">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {/* ".." go up */}
              {prefix !== '' && (
                <tr className="hover:bg-gray-800/30">
                  <td colSpan={6} className="px-4 py-2">
                    <button onClick={goUp} className="flex items-center gap-2 text-gray-400 hover:text-white">
                      <span>↩️</span>
                      <span>..</span>
                    </button>
                  </td>
                </tr>
              )}
              {/* Folders */}
              {data.folders.map(folder => (
                <tr key={folder.prefix} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3">
                    <button onClick={() => enterFolder(folder.prefix)} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                      <span>📁</span>
                      <span className="font-medium">{folder.name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">pasta</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">—</td>
                  <td className="px-4 py-3 text-xs text-gray-500">—</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">—</td>
                </tr>
              ))}
              {/* Files */}
              {data.objects.map(obj => {
                const name = basename(obj.key);
                const isRenaming = renaming === obj.key;
                return (
                  <tr key={obj.key} className={`hover:bg-gray-800/30 ${selected.has(obj.key) ? 'bg-blue-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(obj.key)} onChange={() => toggleSelect(obj.key)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(obj.key); if (e.key === 'Escape') setRenaming(null); }}
                            autoFocus
                            className="flex-1 rounded bg-gray-800 border border-blue-500 px-2 py-1 text-sm text-white focus:outline-none"
                          />
                          <button onClick={() => commitRename(obj.key)} className="px-2 py-1 rounded bg-green-600 text-xs text-white">✓</button>
                          <button onClick={() => setRenaming(null)} className="px-2 py-1 rounded bg-gray-700 text-xs text-white">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-lg shrink-0">
                            {isImage(obj.key) ? <img src={publicUrlFor(obj.key)} alt="" className="w-full h-full object-cover rounded" /> : isVideo(obj.key) ? '🎬' : '📄'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{name}</p>
                            <p className="text-[10px] text-gray-600 font-mono truncate">{obj.key}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {isImage(obj.key) ? '🖼️ img' : isVideo(obj.key) ? '🎬 vid' : '📄'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{formatBytes(obj.size)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{obj.lastModified ? new Date(obj.lastModified).toLocaleString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigator.clipboard.writeText(publicUrlFor(obj.key))} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-blue-400 hover:bg-blue-900/20" title="Copiar URL">
                          📋
                        </button>
                        <a href={publicUrlFor(obj.key)} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-xs text-gray-400 hover:text-green-400 hover:bg-green-900/20" title="Abrir">
                          🔗
                        </a>
                        <button onClick={() => startRename(obj.key)} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-yellow-400 hover:bg-yellow-900/20" title="Renomear">
                          ✏️
                        </button>
                        <button onClick={() => deleteOne(obj.key)} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20" title="Excluir">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
