'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Device } from '@/lib/types';
import QrScannerModal from './QrScannerModal';

interface Campaign { id: string; name: string; status: string; organization_id?: string; }
interface LayoutTemplate { id: string; name: string; }

type ViewMode = 'grid' | 'list';

interface SessionProfile {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  org_name: string | null;
}

export default function DevicesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [layouts, setLayouts] = useState<LayoutTemplate[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string; color: string; is_global: boolean }[]>([]);
  const [deviceCategories, setDeviceCategories] = useState<Record<string, { category_id: string; is_blocked: boolean }[]>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [quickAssignDevice, setQuickAssignDevice] = useState<Device | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Load session profile first — we need organization_id to scope the device query.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/profile', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setProfileLoading(false);
            setLoading(false);
            setLoadError('Sessão expirada. Faça login novamente.');
          }
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setProfile(json.profile ?? null);
          setProfileLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setProfileLoading(false);
          setLoading(false);
          setLoadError('Não foi possível carregar seu perfil. Tente recarregar a página.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadAll = useCallback(async () => {
    // Refuse to load if we don't yet know the user's scope.
    if (!profile) return;
    setLoadError(null);
    try {
      // Build device query with explicit org filter for defense-in-depth.
      // The API already filters non-super_admin by their organization_id, but
      // passing it explicitly avoids relying solely on the cookie-derived user.
      const isSuperAdmin = profile.role === 'super_admin';
      const orgId = profile.organization_id || '';
      const devQuery = isSuperAdmin
        ? '/api/admin/crud/devices?order=created_at&asc=false'
        : orgId
          ? `/api/admin/crud/devices?order=created_at&asc=false&organization_id=${encodeURIComponent(orgId)}`
          : '/api/admin/crud/devices?order=created_at&asc=false';

      const orgQuery = isSuperAdmin
        ? '/api/admin/crud/organizations?order=name&asc=true'
        : '/api/admin/crud/organizations?order=name&asc=true'; // API auto-filters to own org for non-super_admin
      const unitQuery = orgQuery.replace('organizations', 'units');

      console.log('[devices] org_id:', profile.organization_id, 'query:', devQuery);
      const [devRes, orgRes, unitRes, campRes, layRes, catRes] = await Promise.all([
        fetch(devQuery, { credentials: 'include' }),
        fetch(orgQuery, { credentials: 'include' }),
        fetch(unitQuery, { credentials: 'include' }),
        fetch('/api/admin/crud/campaigns?status=active', { credentials: 'include' }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/admin/layouts', { credentials: 'include' }).then(r => r.json()).catch(() => ({ templates: [] })),
        fetch('/api/dashboard/categories', { credentials: 'include' }).then(r => r.json()).catch(() => ({ categories: [] })),
      ]);

      if (!devRes || typeof devRes.ok !== 'boolean') {
        setLoadError('Erro de comunicação com o servidor. Recarregue a página.');
        setDevices([]);
        setLoading(false);
        return;
      }
      if (!devRes.ok) {
        let msg = `Erro ${devRes.status} ao buscar dispositivos`;
        try {
          const errBody = await devRes.json();
          if (errBody?.error) msg = errBody.error;
        } catch {}
        setLoadError(msg);
        setDevices([]);
        setLoading(false);
        return;
      }
      const devJson = await devRes.json();
      const orgJson = await orgRes.json();
      const unitJson = await unitRes.json();
      const catJson = await catRes.json();
      const devicesList = devJson.data ?? [];
      setDevices(devicesList);
      setOrgs((orgJson.data ?? []) as { id: string; name: string }[]);
      setCategories((catJson.categories ?? []) as { id: string; name: string; icon: string; color: string; is_global: boolean }[]);

      // Carrega categorias atribuídas aos devices
      if (devicesList.length > 0) {
        try {
          const deviceIds = devicesList.map((d: { id: string }) => d.id);
          const dcRes = await fetch('/api/dashboard/devices/all-categories?ids=' + deviceIds.join(','), { credentials: 'include' });
          if (dcRes.ok) {
            const dcJson = await dcRes.json();
            setDeviceCategories(dcJson.assignments ?? {});
          }
        } catch {}
      }
      setUnits((unitJson.data ?? []) as { id: string; name: string }[]);

      const [draftRes, pausedRes] = await Promise.all([
        fetch('/api/admin/crud/campaigns?status=draft', { credentials: 'include' }),
        fetch('/api/admin/crud/campaigns?status=paused', { credentials: 'include' }),
      ]);
      const draftJson = await draftRes.json();
      const pausedJson = await pausedRes.json();
      const allCampaigns = [...(campRes.data ?? []), ...(draftJson.data ?? []), ...(pausedJson.data ?? [])];
      setCampaigns(Array.from(new Map(allCampaigns.map((c: Campaign) => [c.id, c])).values()));
      setLayouts((layRes.templates ?? []) as LayoutTemplate[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido ao carregar dados.';
      setLoadError(msg);
      setDevices([]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    loadAll();
  }, [profile, loadAll]);
  useEffect(() => {
    if (!profile) return;
    const i = setInterval(loadAll, 15000);
    return () => clearInterval(i);
  }, [profile, loadAll]);

  // Org-less non-super-admin: explain why nothing shows instead of an empty list.
  const needsOrg = profile && profile.role !== 'super_admin' && !profile.organization_id;
  const showProfileGate = !profileLoading && (needsOrg || !profile);

  function isOnline(d: Device): boolean {
    if (!d.last_heartbeat) return false;
    return Date.now() - new Date(d.last_heartbeat).getTime() < 5 * 60 * 1000;
  }

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  const onlineCount = devices.filter(d => isOnline(d)).length;
  const offlineCount = devices.length - onlineCount;
  const withCampaign = devices.filter(d => d.campaign_id).length;

  const filtered = devices.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.device_uuid?.toLowerCase().includes(search.toLowerCase()) ||
      d.model?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'online' && isOnline(d)) ||
      (filterStatus === 'offline' && !isOnline(d));
    const matchCategory = !filterCategory ||
      (deviceCategories[d.id] || []).some(c => c.category_id === filterCategory);
    return matchSearch && matchStatus && matchCategory;
  });

  function startEdit(d: Device) {
    router.push(`/dashboard/devices/${d.id}`);
    setActionMenuId(null);
  }

  function startCreate() {
    setShowQrScanner(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/crud/devices?id=${deleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao excluir' }));
      alert('Erro ao excluir: ' + (err.error || res.statusText));
      setDeleteId(null);
      return;
    }
    setDeleteId(null); loadAll();
  }

  async function quickAssignCampaign(deviceId: string, campId: string | null) {
    await fetch('/api/admin/crud/devices', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deviceId, campaign_id: campId, content_version: Date.now() % 100000, updated_at: new Date().toISOString() }),
    });
    setQuickAssignDevice(null);
    loadAll();
  }

  async function forceSyncDevice(id: string) {
    setActionMenuId(null);
    try {
      const res = await fetch('/api/admin/rpc/bump_device_content_version', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_device_id: id }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao sincronizar: ${err.error || res.statusText}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      // Log the sync action
      await fetch('/api/admin/device-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: id, event_type: 'sync', message: 'Sync forçado pelo dashboard' }),
      }).catch(() => {});
      alert(`Sincronização forçada com sucesso!`);
      loadAll();
    } catch (e: any) {
      alert(`Erro ao sincronizar: ${e?.message || 'desconhecido'}`);
    }
  }

  async function restartDevice(id: string) {
    setActionMenuId(null);
    try {
      const res = await fetch('/api/admin/crud/devices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restart_requested: true }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao reiniciar: ${err.error || res.statusText}`);
        return;
      }
      await fetch('/api/admin/device-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: id, event_type: 'info', message: 'Reinício solicitado pelo dashboard' }),
      }).catch(() => {});
      alert(`Reinício solicitado!`);
    } catch (e: any) {
      alert(`Erro ao reiniciar: ${e?.message || 'desconhecido'}`);
    }
  }

  // Profile gate: explain when the user is not bound to an organization.
  if (showProfileGate) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Você não está vinculado a uma organização</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              {needsOrg
                ? 'Sua conta ainda não foi associada a uma organização. Peça ao administrador para concluir o cadastro ou entre em contato com o suporte.'
                : 'Não foi possível identificar sua conta. Tente fazer login novamente.'}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={() => router.push('/dashboard')} className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700">
                Ir para o início
              </button>
              <button onClick={() => { setProfileLoading(true); setLoadError(null); router.refresh(); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quick assign view
  if (quickAssignDevice) {
    const deviceCampaigns = campaigns.filter(c => !quickAssignDevice.organization_id || c.organization_id === quickAssignDevice.organization_id);
    return (
      <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setQuickAssignDevice(null)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Voltar
          </button>
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Campanha</h1>
            <p className="text-sm text-gray-400 mt-1">{quickAssignDevice.name}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => quickAssignCampaign(quickAssignDevice.id, null)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${!quickAssignDevice.campaign_id ? 'bg-green-900/20 border-green-600/50 ring-1 ring-green-600/30' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Nenhuma campanha</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Dispositivo em standby</p>
                </div>
                {!quickAssignDevice.campaign_id && <span className="text-green-400 text-lg">✓</span>}
              </div>
            </button>
            {deviceCampaigns.map(c => (
              <button
                key={c.id}
                onClick={() => quickAssignCampaign(quickAssignDevice.id, c.id)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${quickAssignDevice.campaign_id === c.id ? 'bg-blue-900/20 border-blue-600/50 ring-1 ring-blue-600/30' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium mt-1 ${c.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                  </div>
                  {quickAssignDevice.campaign_id === c.id && <span className="text-blue-400 text-lg">✓</span>}
                </div>
              </button>
            ))}
            {deviceCampaigns.length === 0 && <p className="text-center text-gray-600 text-sm py-4">Nenhuma campanha disponível</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Error banner — surfaces fetch/permission errors instead of swallowing them */}
        {loadError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-700/50 bg-red-900/20 p-4">
            <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-200">Não foi possível carregar os dispositivos</p>
              <p className="text-xs text-red-300/80 mt-0.5 break-words">{loadError}</p>
            </div>
            <button onClick={() => loadAll()} className="rounded-lg bg-red-600/30 border border-red-600/50 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-600/50">
              Tentar de novo
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Dispositivos</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">{devices.length} registrado{devices.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2 mt-2 text-xs">
              <Link href="/dashboard/devices" className="px-3 py-1.5 rounded-md bg-blue-900/30 text-blue-300 border border-blue-700/50">� Dispositivos</Link>
              <Link href="/dashboard/devices/activation-codes" className="px-3 py-1.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700">🔑 Códigos</Link>
              <Link href="/dashboard/devices/uptime" className="px-3 py-1.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700">� Uptime</Link>
            </div>
          </div>
          <button onClick={() => startCreate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Dispositivo
          </button>
          <button onClick={() => setShowQrScanner(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m-7-9h1m14 0h1M5.6 5.6l.7.7m12.1-.7l-.7.7M5.6 18.4l.7-.7m12.1.7l-.7-.7" /></svg>
            Ler QR Code
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button onClick={() => setFilterStatus('all')}
            className={`rounded-xl border p-4 text-left transition-all ${filterStatus === 'all' ? 'bg-gray-800 border-gray-600' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}>
            <div className="text-2xl font-bold text-white">{devices.length}</div>
            <div className="text-xs text-gray-500 mt-1">Total</div>
          </button>
          <button onClick={() => setFilterStatus('online')}
            className={`rounded-xl border p-4 text-left transition-all ${filterStatus === 'online' ? 'bg-green-900/20 border-green-600/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <div className="text-2xl font-bold text-green-400">{onlineCount}</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Online</div>
          </button>
          <button onClick={() => setFilterStatus('offline')}
            className={`rounded-xl border p-4 text-left transition-all ${filterStatus === 'offline' ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="text-2xl font-bold text-red-400">{offlineCount}</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Offline</div>
          </button>
          <div className="rounded-xl border bg-gray-900/50 border-gray-800 p-4">
            <div className="text-2xl font-bold text-blue-400">{withCampaign}</div>
            <div className="text-xs text-gray-500 mt-1">Com campanha</div>
          </div>
        </div>

        {/* Search + View Toggle + Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, UUID ou modelo..."
              className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors min-w-[180px]">
            <option value="">🏷️ Todas categorias</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.is_global ? '🌍 ' : ''}{c.icon} {c.name}
              </option>
            ))}
          </select>
          {filterCategory && (
            <button onClick={() => setFilterCategory('')}
              className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-400 hover:text-white">
              ✕ Limpar
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${viewMode === 'grid' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setViewMode('list')}
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${viewMode === 'list' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm">Carregando dispositivos...</span>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-gray-400 font-medium">Nenhum dispositivo encontrado</p>
            <p className="text-sm text-gray-600 mt-1">{search ? 'Tente outro termo de busca' : 'Adicione o primeiro dispositivo'}</p>
          </div>
        )}

        {/* Grid View */}
        {!loading && viewMode === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(device => {
              const online = isOnline(device);
              const campName = campaigns.find(c => c.id === device.campaign_id)?.name;
              const layName = layouts.find(l => l.id === device.layout_template_id)?.name;
              const initials = device.name.slice(0, 2).toUpperCase();
              return (
                <div key={device.id} className="group rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all overflow-hidden">
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${online ? 'bg-green-900/40 text-green-400 ring-1 ring-green-600/30' : 'bg-gray-800 text-gray-500'}`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{device.name}</h3>
                          <p className="text-[11px] text-gray-600 font-mono truncate">{device.device_uuid?.slice(0, 12)}...</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button onClick={() => setActionMenuId(actionMenuId === device.id ? null : device.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-white hover:bg-gray-800 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                        </button>
                        {actionMenuId === device.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
                            <div className="absolute right-0 top-10 z-50 w-52 rounded-xl bg-gray-800 border border-gray-700 shadow-2xl py-1.5">
                              <button onClick={() => { setQuickAssignDevice(device); setActionMenuId(null); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
                                <span className="text-purple-400">📢</span> Atribuir campanha
                              </button>
                              <button onClick={() => startEdit(device)} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
                                <span className="text-blue-400">✏️</span> Editar
                              </button>
                              <button onClick={() => forceSyncDevice(device.id)} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
                                <span className="text-yellow-400">⚡</span> Forçar sync
                              </button>
                              <button onClick={() => restartDevice(device.id)} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
                                <span className="text-orange-400">🔄</span> Reiniciar APK
                              </button>
                              <button onClick={() => router.push(`/dashboard/devices/${device.id}`)} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
                                <span className="text-green-400">📊</span> Detalhes
                              </button>
                              <div className="mx-3 my-1 border-t border-gray-700" />
                              <button onClick={() => { setDeleteId(device.id); setActionMenuId(null); }} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-3">
                                <span>🗑️</span> Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status pill */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${online ? 'bg-green-900/30 text-green-400 ring-1 ring-green-600/20' : 'bg-red-900/30 text-red-400 ring-1 ring-red-600/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                        {online ? 'Online' : 'Offline'}
                      </div>
                      {device.player_version && (
                        <span className="inline-flex rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-mono text-gray-500">v{device.player_version}</span>
                      )}
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="px-5 pb-3 space-y-2">
                    {campName ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Campanha</span>
                        <span className="inline-flex rounded-lg bg-blue-900/30 px-2 py-0.5 text-[11px] font-medium text-blue-300 truncate">{campName}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Campanha</span>
                        <span className="text-[11px] text-gray-700 italic">Nenhuma</span>
                      </div>
                    )}
                    {layName && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Layout</span>
                        <span className="text-[11px] text-gray-400 truncate">{layName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Modelo</span>
                      <span className="text-[11px] text-gray-400 truncate">{device.model || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Último</span>
                      <span className="text-[11px] text-gray-500">{device.last_heartbeat ? `${timeSince(device.last_heartbeat)} atrás` : 'Nunca conectou'}</span>
                    </div>
                  </div>

                  {/* Quick actions footer */}
                  <div className="border-t border-gray-800/50 px-5 py-3 flex items-center gap-2">
                    <button onClick={() => setQuickAssignDevice(device)}
                      className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-750 py-2 text-[11px] font-medium text-gray-400 hover:text-white transition-colors text-center border border-gray-700/50">
                      Campanha
                    </button>
                    <button onClick={() => startEdit(device)}
                      className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-750 py-2 text-[11px] font-medium text-gray-400 hover:text-white transition-colors text-center border border-gray-700/50">
                      Editar
                    </button>
                    <button onClick={() => forceSyncDevice(device.id)}
                      className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-750 py-2 text-[11px] font-medium text-gray-400 hover:text-white transition-colors text-center border border-gray-700/50">
                      Sync
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {!loading && viewMode === 'list' && filtered.length > 0 && (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dispositivo</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Campanha</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Layout</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Heartbeat</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Versão</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map(device => {
                    const online = isOnline(device);
                    const campName = campaigns.find(c => c.id === device.campaign_id)?.name;
                    const layName = layouts.find(l => l.id === device.layout_template_id)?.name;
                    return (
                      <tr key={device.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className={`text-xs font-medium ${online ? 'text-green-400' : 'text-red-400'}`}>{online ? 'Online' : 'Offline'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-white">{device.name}</div>
                          <div className="text-[11px] text-gray-600 font-mono">{device.device_uuid?.slice(0, 8)}...</div>
                        </td>
                        <td className="px-5 py-4">
                          {campName ? (
                            <span className="inline-flex rounded-lg bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-300">{campName}</span>
                          ) : <span className="text-xs text-gray-700 italic">—</span>}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400">{layName || 'Padrão'}</td>
                        <td className="px-5 py-4 text-xs text-gray-500">{device.last_heartbeat ? `${timeSince(device.last_heartbeat)} atrás` : 'Nunca'}</td>
                        <td className="px-5 py-4 text-xs text-gray-500 font-mono">{device.player_version || '—'}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => forceSyncDevice(device.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-yellow-400 hover:bg-yellow-900/20 transition-colors" title="Forçar sync">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </button>
                            <button onClick={() => restartDevice(device.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-orange-400 hover:bg-orange-900/20 transition-colors" title="Reiniciar">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <button onClick={() => router.push(`/dashboard/devices/${device.id}`)} className="w-8 h-8 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-900/20 transition-colors" title="Detalhes">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button onClick={() => setQuickAssignDevice(device)} className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-900/20 transition-colors" title="Campanha">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </button>
                            <button onClick={() => startEdit(device)} className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-900/20 transition-colors" title="Editar">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => setDeleteId(device.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-900/20 transition-colors" title="Excluir">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-800/50">
              {filtered.map(device => {
                const online = isOnline(device);
                const campName = campaigns.find(c => c.id === device.campaign_id)?.name;
                return (
                  <div key={device.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${online ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {device.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white truncate">{device.name}</h3>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                        <p className="text-[11px] text-gray-600 font-mono truncate">{device.device_uuid?.slice(0, 12)}...</p>
                      </div>
                      <button onClick={() => setActionMenuId(actionMenuId === device.id ? null : device.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-800">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                      </button>
                    </div>
                    {campName && (
                      <span className="inline-flex rounded-lg bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-300 mb-2">{campName}</span>
                    )}
                    <div className="text-[11px] text-gray-600">
                      {device.last_heartbeat ? `Último heartbeat: ${timeSince(device.last_heartbeat)} atrás` : 'Nunca conectou'}
                    </div>

                    {/* Mobile action menu */}
                    {actionMenuId === device.id && (
                      <>
                        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setActionMenuId(null)} />
                        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl p-4 safe-bottom">
                          <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
                          <div className="space-y-1">
                            <button onClick={() => { setQuickAssignDevice(device); setActionMenuId(null); }}
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-xl flex items-center gap-3">
                              <span className="text-purple-400 text-lg">📢</span> Atribuir campanha
                            </button>
                            <button onClick={() => startEdit(device)}
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-xl flex items-center gap-3">
                              <span className="text-blue-400 text-lg">✏️</span> Editar
                            </button>
                            <button onClick={() => { forceSyncDevice(device.id); }}
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-xl flex items-center gap-3">
                              <span className="text-yellow-400 text-lg">⚡</span> Forçar sync
                            </button>
                            <button onClick={() => { restartDevice(device.id); }}
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-xl flex items-center gap-3">
                              <span className="text-orange-400 text-lg">🔄</span> Reiniciar APK
                            </button>
                            <button onClick={() => { router.push(`/dashboard/devices/${device.id}`); setActionMenuId(null); }}
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-xl flex items-center gap-3">
                              <span className="text-green-400 text-lg">📊</span> Detalhes
                            </button>
                            <div className="border-t border-gray-800 my-2" />
                            <button onClick={() => { setDeleteId(device.id); setActionMenuId(null); }}
                              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 rounded-xl flex items-center gap-3">
                              <span className="text-lg">🗑️</span> Excluir
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Delete Confirmation */}
        {deleteId && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-900/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Excluir dispositivo?</h3>
                <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita. O dispositivo será removido permanentemente.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteId(null)}
                    className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-750 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleDelete}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* QR Scanner */}
        {showQrScanner && (
          <QrScannerModal
            onClose={() => setShowQrScanner(false)}
            onScanned={async (deviceUuid) => {
              setShowQrScanner(false);
              try {
                // Try to find existing device first
                const found = devices.find(d => d.device_uuid === deviceUuid || d.id === deviceUuid);
                if (found) {
                  router.push(`/dashboard/devices/${found.id}`);
                  return;
                }
                // Not found — try to create via scan-or-create endpoint
                const res = await fetch('/api/admin/devices/scan-or-create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ device_uuid: deviceUuid }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(`Erro: ${data.error || 'desconhecido'}`);
                  return;
                }
                if (data.created) {
                  alert(`✅ Novo dispositivo criado! Vincule-o a uma campanha agora.`);
                }
                router.push(`/dashboard/devices/${data.device.id}`);
              } catch (e: any) {
                alert(`Erro: ${e?.message || 'desconhecido'}`);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
