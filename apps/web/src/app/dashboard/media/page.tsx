'use client';

import { useEffect, useState, useRef } from 'react';
import type { Media } from '@/lib/types';
import { convertImageToWebP, formatBytes } from '@/lib/image-convert';
import VideoThumbnail from '@/components/video-thumbnail';

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailMedia, setDetailMedia] = useState<Media | null>(null);
  const [editName, setEditName] = useState('');
  const [ttlDays, setTtlDays] = useState<number>(7); // 0 = forever, default 7 days
  const [expiresReason, setExpiresReason] = useState<string>('');
  const [showReasonDialog, setShowReasonDialog] = useState<boolean>(false);
  const [uploadDisplayName, setUploadDisplayName] = useState<string>('');
  const [uploadOrientation, setUploadOrientation] = useState<string>('auto');
  const [editOrientation, setEditOrientation] = useState<string>('auto');
  const [mediaCategories, setMediaCategories] = useState<{ id: string; name: string; icon: string; color: string; is_default: boolean; is_global: boolean }[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [availableCats, setAvailableCats] = useState<{ id: string; name: string; icon: string; color: string; is_default: boolean; is_global: boolean }[]>([]);
  const [extendDays, setExtendDays] = useState<number>(7);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only super_admin can do cross-org blocking (excluded_organization_ids, excluded_device_ids)
  const isSuperAdmin = currentUserRole === 'super_admin';
  const isOrgAdmin = !!currentUserOrgId && !isSuperAdmin;

  // Pre-upload config modal state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [preTtlDays, setPreTtlDays] = useState<number>(7);
  const [preDisplayName, setPreDisplayName] = useState<string>('');
  const [preOrientation, setPreOrientation] = useState<string>('auto');
  const [preCategoryIds, setPreCategoryIds] = useState<Set<string>>(new Set());
  const [preExcludedCatIds, setPreExcludedCatIds] = useState<Set<string>>(new Set());
  const [preExcludedOrgIds, setPreExcludedOrgIds] = useState<Set<string>>(new Set());
  const [preExcludedDeviceIds, setPreExcludedDeviceIds] = useState<Set<string>>(new Set());
  const [preShowReason, setPreShowReason] = useState<boolean>(false);
  const [preReason, setPreReason] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<{ id: string; name: string; org_name?: string; status: string }[]>([]);
  const [preDeviceSearch, setPreDeviceSearch] = useState<string>('');

  useEffect(() => { loadMedia(); loadOrgs(); loadAvailableCategories(); loadAvailableDevices(); }, []);

  async function loadAvailableCategories() {
    try {
      const r = await fetch('/api/dashboard/categories');
      const j = await r.json();
      setAvailableCats(j.categories ?? []);
    } catch (e) { console.error('loadAvailableCategories', e); }
  }

  async function loadAvailableDevices() {
    try {
      const r = await fetch('/api/admin/crud/devices?order=name&asc=true&limit=500');
      const j = await r.json();
      const list = (j.data ?? []) as { id: string; name: string; status: string; organization_id: string }[];
      // Enrich with org name
      const orgsList = orgs.length > 0 ? orgs : ((await (await fetch('/api/admin/crud/organizations?order=name&asc=true')).json()).data ?? []) as { id: string; name: string }[];
      const orgMap = new Map(orgsList.map((o: { id: string; name: string }) => [o.id, o.name]));
      setAvailableDevices(list.map((d) => ({
        id: d.id,
        name: d.name || `Device ${d.id.slice(0, 6)}`,
        status: d.status,
        org_name: orgMap.get(d.organization_id),
      })));
    } catch (e) { console.error('loadAvailableDevices', e); }
  }

  async function loadMedia() {
    const res = await fetch('/api/admin/crud/media?order=created_at&asc=false&limit=500');
    const json = await res.json();
    const list = (json.data ?? []) as Media[];
    // Ordena por data de vencimento: sem expires_at vai pro final,
    // mais próximo do vencimento primeiro
    list.sort((a, b) => {
      const ax = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
      const bx = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
      return ax - bx;
    });
    setMedia(list);
    setLoading(false);
  }

  async function loadOrgs() {
    try {
      // Load orgs and user profile in parallel
      const [orgsRes, profileRes] = await Promise.all([
        fetch('/api/admin/crud/organizations?order=name&asc=true'),
        fetch('/api/auth/profile'),
      ]);
      const orgsJson = await orgsRes.json();
      const profileJson = profileRes.json();
      const orgsList = (orgsJson.data ?? []) as { id: string; name: string }[];
      setOrgs(orgsList);

      // Auto-select user's org (or first if super_admin)
      const profile = await profileJson;
      if (profile?.profile) {
        const userOrg = profile.profile.organization_id;
        setCurrentUserRole(profile.profile.role || '');
        setCurrentUserOrgId(userOrg || '');
        // Non-super_admin: force their own org, lock the dropdown
        if (userOrg && profile.profile.role !== 'super_admin') {
          setOrganizationId(userOrg);
        } else {
          setOrganizationId(userOrg || (orgsList[0]?.id ?? ''));
        }
      }
    } catch (e) {
      console.error('loadOrgs failed:', e);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!organizationId) { alert('Selecione uma organização primeiro.'); return; }
    // Open the pre-upload config modal — does NOT upload yet
    setPendingFile(file);
    setPendingPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setPreDisplayName(file.name.replace(/\.[^.]+$/, ''));
    setPreOrientation('auto');
    setPreTtlDays(7);
    setPreReason('');
    setPreShowReason(false);
    setPreCategoryIds(new Set());
    setPreExcludedCatIds(new Set());
    setPreExcludedOrgIds(new Set());
    setPreExcludedDeviceIds(new Set());
    setPreDeviceSearch('');
  }

  function closeUploadConfig() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPreShowReason(false);
    setPreReason('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmUpload() {
    const originalFile = pendingFile;
    if (!originalFile) return;
    // Validate "manter para sempre" reason
    let reason = '';
    if (preTtlDays === 0) {
      if (preReason.trim().length < 10) {
        alert('Para "Manter para sempre" é necessário justificar com pelo menos 10 caracteres.');
        return;
      }
      reason = preReason.trim();
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
          ttl_days: preTtlDays,
          expires_reason: preTtlDays === 0 ? reason : undefined,
          display_name: preDisplayName.trim() || undefined,
          default_orientation: preOrientation,
          category_ids: Array.from(preCategoryIds),
          excluded_category_ids: Array.from(preExcludedCatIds),
          // Cross-org blocking only for super_admin
          excluded_organization_ids: isSuperAdmin ? Array.from(preExcludedOrgIds) : [],
          excluded_device_ids: isSuperAdmin ? Array.from(preExcludedDeviceIds) : [],
        }),
      });

      if (saveRes.ok) {
        const savedJson = await saveRes.json();
        const newMediaId = savedJson.media?.id || savedJson.id;
        // Assign categories if any were selected
        if (newMediaId && preCategoryIds.size > 0) {
          await fetch(`/api/dashboard/media/${newMediaId}/categories`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_ids: Array.from(preCategoryIds) }),
          }).catch(() => {});
        }
        const ttlLabel = preTtlDays === 0 ? 'para sempre' : `por ${preTtlDays} dias`;
        alert(`Upload concluído! Arquivo será mantido ${ttlLabel}.`);
        closeUploadConfig();
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
    const r = await fetch('/api/admin/crud/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailMedia.id, display_name: editName.trim() }),
    });
    if (!r.ok) { const err = await r.json().catch(() => ({})); alert('Erro: ' + (err.error || r.statusText)); return; }
    setDetailMedia({ ...detailMedia, display_name: editName.trim() });
    loadMedia();
  }

  async function handleOrientationChange() {
    if (!detailMedia) return;
    const orient = (['auto', 'portrait', 'landscape'].includes(editOrientation) ? editOrientation : 'auto') as 'auto' | 'portrait' | 'landscape';
    const r = await fetch('/api/admin/crud/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailMedia.id, default_orientation: orient }),
    });
    if (!r.ok) { const err = await r.json().catch(() => ({})); alert('Erro: ' + (err.error || r.statusText)); return; }
    setDetailMedia({ ...detailMedia, default_orientation: orient });
    loadMedia();
  }

  async function loadMediaCategories(mediaId: string) {
    try {
      const [assignedRes, availableRes] = await Promise.all([
        fetch(`/api/dashboard/media/${mediaId}/categories`),
        fetch('/api/dashboard/categories'),
      ]);
      const assigned = assignedRes.ok ? await assignedRes.json() : { categories: [] };
      const available = availableRes.ok ? await availableRes.json() : { categories: [] };
      setMediaCategories(assigned.categories ?? []);
      setAvailableCats(available.categories ?? []);
      setSelectedCatIds(new Set((assigned.categories ?? []).map((c: { category_id: string }) => c.category_id)));
    } catch (e) {
      console.error('loadMediaCategories', e);
    }
  }

  async function toggleCategory(catId: string) {
    const next = new Set(selectedCatIds);
    if (next.has(catId)) next.delete(catId);
    else next.add(catId);
    setSelectedCatIds(next);
    // Auto-save on toggle
    if (detailMedia) {
      await fetch(`/api/dashboard/media/${detailMedia.id}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_ids: Array.from(next) }),
      });
    }
  }

  async function extendExpiration() {
    if (!detailMedia) return;
    try {
      const res = await fetch(`/api/dashboard/media/${detailMedia.id}/extend-expiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: extendDays }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro: ' + (json.error || 'desconhecido'));
        return;
      }
      const updated = { ...detailMedia, expires_at: json.expires_at };
      setDetailMedia(updated);
      loadMedia();
      alert(`✅ Validade prorrogada até ${formatDate(json.expires_at)}`);
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removeExpiration() {
    if (!detailMedia) return;
    if (!confirm('Remover validade? A mídia ficará permanente.')) return;
    try {
      const res = await fetch(`/api/dashboard/media/${detailMedia.id}/extend-expiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 0 }), // 0 = permanente
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro: ' + (json.error || 'desconhecido'));
        return;
      }
      setDetailMedia({ ...detailMedia, expires_at: json.expires_at });
      loadMedia();
      alert('✅ Mídia marcada como permanente (sem validade)');
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function reactivateMedia() {
    if (!detailMedia) return;
    const days = extendDays || 7;
    try {
      const res = await fetch(`/api/dashboard/media/${detailMedia.id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro: ' + (json.error || 'desconhecido'));
        return;
      }
      const updated = { ...detailMedia, expires_at: json.expires_at, status: 'active' };
      setDetailMedia(updated);
      loadMedia();
      alert(`✅ Mídia reativada! Nova validade: ${formatDate(json.expires_at)}`);
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  function isExpired(iso: string): boolean {
    return new Date(iso).getTime() < Date.now();
  }

  function isExpiringSoon(iso: string): boolean {
    const t = new Date(iso).getTime();
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return t > now && t - now < threeDays;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Mídia</h1>
        <div className="flex items-center gap-3">
          {isSuperAdmin ? (
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="">Organização...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : (
            // Admin comum: org trancada na própria org
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
              <span>🏢</span>
              <span className="font-medium">{orgs[0]?.name || 'Sua organização'}</span>
              <span className="text-xs text-gray-400">(travado)</span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || !organizationId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            + Upload
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
            <div key={item.id} onClick={() => { setDetailMedia(item); setEditName(item.display_name || item.name); setEditOrientation(item.default_orientation || 'auto'); loadMediaCategories(item.id); }}
              className="group relative rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all">
              <button onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }} className="absolute top-2 right-2 z-10 rounded-full bg-red-600 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700" title="Excluir">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {item.type === 'image' || item.type === 'gif' ? (
                  <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <VideoThumbnail src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl">📄</div>
                )}
                {item.type === 'video' && (
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">🎬</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.type} · {formatSize(item.file_size)}</p>
                {item.expires_at && (
                  <p className={`text-[11px] mt-1 font-medium ${isExpired(item.expires_at) ? 'text-red-600' : isExpiringSoon(item.expires_at) ? 'text-amber-600' : 'text-gray-500'}`}>
                    ⏱️ Vence em {formatDate(item.expires_at)}
                  </p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((t, i) => (
                      <span key={i} className="inline-block rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-700">
                        #{t}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{item.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-upload config modal */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={closeUploadConfig}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Configurar antes de enviar pro storage</h2>
                <button onClick={closeUploadConfig} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              {/* Preview + arquivo info */}
              <div className="flex gap-4 mb-5 p-3 bg-gray-50 rounded-xl">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                  {pendingPreviewUrl ? (
                    <img src={pendingPreviewUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : pendingFile.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(pendingFile)} className="w-full h-full object-cover" controls muted />
                  ) : (
                    <div className="text-3xl">📄</div>
                  )}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-gray-900 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatSize(pendingFile.size)} · {pendingFile.type || 'desconhecido'}</p>
                  <p className="text-xs text-gray-400 mt-2">Nada será enviado até você clicar em <b>Confirmar e Enviar</b>.</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* === SEÇÃO 1: Informações básicas === */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">📝 Informações básicas</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome de Exibição</label>
                      <input value={preDisplayName} onChange={e => setPreDisplayName(e.target.value)}
                        placeholder="Como você quer que apareça"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">📐 Orientação</label>
                        <select value={preOrientation} onChange={e => setPreOrientation(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none">
                          <option value="auto">Automática</option>
                          <option value="portrait">Vertical (9:16)</option>
                          <option value="landscape">Horizontal (16:9)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">⏰ Expiração</label>
                        <select value={preTtlDays} onChange={e => setPreTtlDays(Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none">
                          <option value={7}>1 semana (padrão)</option>
                          <option value={14}>2 semanas</option>
                          <option value={30}>1 mês</option>
                          <option value={90}>3 meses</option>
                          <option value={365}>1 ano</option>
                          <option value={0}>Manter pra sempre</option>
                        </select>
                      </div>
                    </div>
                    {preTtlDays === 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Justificativa (mín. 10 chars)</label>
                        <textarea value={preReason} onChange={e => setPreReason(e.target.value)}
                          rows={2} placeholder="Por que este arquivo deve ficar permanente?"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none resize-none" />
                      </div>
                    )}
                  </div>
                </section>

                {/* === SEÇÃO 2: Categoria principal === */}
                <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">🏷️ Categoria principal</h3>
                  <p className="text-xs text-gray-500 mb-3">Qual categoria se enquadra esta mídia?</p>
                  <p className="text-xs text-blue-700 mb-2">
                    💡 <b>Importante:</b> o tipo da mídia define onde ela pode aparecer.
                    Mídia de academia geralmente faz sentido em academias, não em farmácias.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableCats.filter(c => c.name !== 'Padrão' || c.id.startsWith('00000000')).map((c) => {
                      const selected = preCategoryIds.has(c.id);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => {
                            const next = new Set(preCategoryIds);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            setPreCategoryIds(next);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${selected ? 'text-white ring-2 ring-blue-400' : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'}`}
                          style={selected ? { backgroundColor: c.color } : undefined}
                        >
                          <span>{c.icon}</span>
                          <span>{c.name}</span>
                          {selected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* === SEÇÃO 3: Onde NÃO deve aparecer (por categoria) === */}
                <section className="rounded-lg border border-red-200 bg-red-50/40 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">🚫 Onde NÃO deve aparecer</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Esta mídia <b>NÃO</b> deve passar em quais tipos de estabelecimento?
                  </p>
                  <p className="text-xs text-red-700 mb-3">
                    💡 Use isso pra evitar conflito com concorrentes. <br />
                    Ex: mídia de Barbearia X pode ser bloqueada em outras Barbearias.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableCats.filter(c => c.name !== 'Padrão' || c.id.startsWith('00000000')).map((c) => {
                      const selected = preExcludedCatIds.has(c.id);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => {
                            const next = new Set(preExcludedCatIds);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            setPreExcludedCatIds(next);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${selected ? 'text-white ring-2 ring-red-400' : 'bg-white text-gray-700 border border-gray-300 hover:border-red-300'}`}
                          style={selected ? { backgroundColor: c.color } : undefined}
                        >
                          <span>{c.icon}</span>
                          <span>{c.name}</span>
                          {selected ? <span>✕ bloqueado</span> : <span className="text-gray-400">pode passar</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* === SEÇÃO 4: Bloquear orgs específicas — SÓ SUPER_ADMIN === */}
                {isSuperAdmin && orgs.length > 0 && (
                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      🏢 Bloquear organizações específicas
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-600 bg-purple-50 px-2 py-0.5 rounded">só super_admin</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Não exibir esta mídia em uma organização específica.
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {orgs.filter(o => o.id !== organizationId).map((o) => {
                        const selected = preExcludedOrgIds.has(o.id);
                        return (
                          <button key={o.id} type="button"
                            onClick={() => {
                              const next = new Set(preExcludedOrgIds);
                              if (next.has(o.id)) next.delete(o.id);
                              else next.add(o.id);
                              setPreExcludedOrgIds(next);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${selected ? 'bg-red-100 text-red-700 ring-2 ring-red-400' : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'}`}
                          >
                            <span>{selected ? '✕' : '○'}</span>
                            <span>{o.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* === SEÇÃO 5: Bloquear dispositivos/terminais específicos — SÓ SUPER_ADMIN === */}
                {isSuperAdmin && availableDevices.length > 0 && (
                  <section className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      📺 Bloquear terminais específicos
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-600 bg-purple-50 px-2 py-0.5 rounded">só super_admin</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Não exibir esta mídia em um <b>terminal</b> (TV específica) — útil pra bloquear concorrentes mesmo estando na mesma categoria.
                    </p>
                    {preExcludedDeviceIds.size > 0 && (
                      <div className="mb-2 text-xs text-orange-700">
                        {preExcludedDeviceIds.size} terminal(is) bloqueado(s)
                      </div>
                    )}
                    <input
                      type="text"
                      value={preDeviceSearch}
                      onChange={(e) => setPreDeviceSearch(e.target.value)}
                      placeholder="🔍 Buscar terminal por nome..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                      {availableDevices
                        .filter(d => !preDeviceSearch || d.name.toLowerCase().includes(preDeviceSearch.toLowerCase()) || (d.org_name && d.org_name.toLowerCase().includes(preDeviceSearch.toLowerCase())))
                        .map((d) => {
                          const selected = preExcludedDeviceIds.has(d.id);
                          return (
                            <button key={d.id} type="button"
                              onClick={() => {
                                const next = new Set(preExcludedDeviceIds);
                                if (next.has(d.id)) next.delete(d.id);
                                else next.add(d.id);
                                setPreExcludedDeviceIds(next);
                              }}
                              title={d.org_name ? `${d.org_name} • ${d.status}` : d.status}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${selected ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-400' : 'bg-white text-gray-700 border border-gray-300 hover:border-orange-300'}`}
                            >
                              <span>{selected ? '✕' : '📺'}</span>
                              <span>{d.name}{d.org_name ? ` · ${d.org_name}` : ''}</span>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                )}

                {!isSuperAdmin && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 text-xs text-purple-800">
                    💡 <b>Bloqueio entre organizações e por terminal</b> é um poder exclusivo de <b>super_admin</b>.
                    Se você precisa bloquear categorias ou locais, use a seção acima (categorias).<br />
                    Para bloqueios cross-org, contate o super_admin.
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={confirmUpload} disabled={uploading || (preTtlDays === 0 && preReason.trim().length < 10)}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      <>🚀 Confirmar e Enviar</>
                    )}
                  </button>
                  <button onClick={closeUploadConfig} disabled={uploading}
                    className="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
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
                    <label className="block text-xs text-gray-500 mb-1">Nome de Exibição</label>
                    <div className="flex gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                      <button onClick={handleRename}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Salvar</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Orientação Padrão da Mídia</label>
                    <div className="flex gap-2">
                      <select value={editOrientation} onChange={e => setEditOrientation(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none">
                        <option value="auto">Automática (segue config do player)</option>
                        <option value="portrait">Vertical (Retrato)</option>
                        <option value="landscape">Horizontal (Paisagem)</option>
                      </select>
                      <button onClick={handleOrientationChange}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Salvar</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🏷️ Categorias</label>
                    <p className="text-xs text-gray-400 mb-2">Mídia sem categoria → vai para "Padrão" automaticamente</p>
                    <div className="flex flex-wrap gap-2">
                      {availableCats.map((c) => {
                        const selected = selectedCatIds.has(c.id);
                        return (
                          <button key={c.id} type="button" onClick={() => toggleCategory(c.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            style={selected ? { backgroundColor: c.color } : undefined}
                          >
                            <span>{c.icon}</span>
                            <span>{c.name}</span>
                            {c.is_default && <span className="text-xs opacity-70">•</span>}
                            {selected && <span className="text-xs">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <label className="block text-xs text-gray-500 mb-2">⏱️ Validade / Expiração</label>
                    <div className="mb-2 text-sm">
                      <span className="text-gray-500">Data atual:</span>{' '}
                      {detailMedia.expires_at ? (
                        <span className={`font-medium ${isExpired(detailMedia.expires_at) ? 'text-red-600' : isExpiringSoon(detailMedia.expires_at) ? 'text-amber-600' : 'text-gray-900'}`}>
                          {formatDate(detailMedia.expires_at)}
                          {isExpired(detailMedia.expires_at) && ' (VENCIDA)'}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">∞ Permanente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        value={extendDays}
                        onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <span className="text-xs text-gray-500">dias</span>
                      <button onClick={extendExpiration}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                        ➕ Prorrogar
                      </button>
                      {detailMedia.expires_at && (
                        <button onClick={removeExpiration}
                          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-300">
                          ∞ Permanente
                        </button>
                      )}
                      {detailMedia.expires_at && isExpired(detailMedia.expires_at) && (
                        <button onClick={reactivateMedia}
                          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700">
                          ♻️ Reativar
                        </button>
                      )}
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
