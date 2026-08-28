'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Device } from '@/lib/types';

interface Campaign { id: string; name: string; status: string; organization_id?: string; }
interface LayoutTemplate { id: string; name: string; }

type ViewMode = 'grid' | 'list';

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [layouts, setLayouts] = useState<LayoutTemplate[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [quickAssignDevice, setQuickAssignDevice] = useState<Device | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [campaignId, setCampaignId] = useState('');
  const [layoutId, setLayoutId] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [devRes, orgRes, unitRes, campRes, layRes] = await Promise.all([
        fetch('/api/admin/crud/devices?order=created_at&asc=false'),
        fetch('/api/admin/crud/organizations?order=name&asc=true'),
        fetch('/api/admin/crud/units?order=name&asc=true'),
        fetch('/api/admin/crud/campaigns?status=active').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/admin/layouts').then(r => r.json()).catch(() => ({ templates: [] })),
      ]);
      const devJson = await devRes.json();
      const orgJson = await orgRes.json();
      const unitJson = await unitRes.json();
      setDevices(devJson.data ?? []);
      setOrgs((orgJson.data ?? []) as { id: string; name: string }[]);
      setUnits((unitJson.data ?? []) as { id: string; name: string }[]);

      const [draftRes, pausedRes] = await Promise.all([
        fetch('/api/admin/crud/campaigns?status=draft'),
        fetch('/api/admin/crud/campaigns?status=paused'),
      ]);
      const draftJson = await draftRes.json();
      const pausedJson = await pausedRes.json();
      const allCampaigns = [...(campRes.data ?? []), ...(draftJson.data ?? []), ...(pausedJson.data ?? [])];
      setCampaigns(Array.from(new Map(allCampaigns.map((c: Campaign) => [c.id, c])).values()));
      setLayouts((layRes.templates ?? []) as LayoutTemplate[]);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const i = setInterval(loadAll, 15000); return () => clearInterval(i); }, [loadAll]);

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
    return matchSearch && matchStatus;
  });

  function resetForm() {
    setName(''); setModel(''); setDeviceUuid(''); setOrganizationId(''); setUnitId('');
    setOrientation('landscape'); setCampaignId(''); setLayoutId(''); setEditing(null); setShowForm(false);
  }

  function startEdit(d: Device) {
    setEditing(d);
    setName(d.name); setModel(d.model || ''); setDeviceUuid(d.device_uuid || '');
    setOrganizationId(d.organization_id); setUnitId(d.unit_id || '');
    setOrientation(d.orientation || 'landscape');
    setCampaignId(d.campaign_id || '');
    setLayoutId(d.layout_template_id || '');
    setShowForm(true);
    setActionMenuId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      name, model: model || null, device_uuid: deviceUuid,
      organization_id: organizationId, unit_id: unitId || null,
      orientation, updated_at: new Date().toISOString(),
      campaign_id: campaignId || null, layout_template_id: layoutId || null,
      screen_rotation: editing?.screen_rotation || 0,
      mirror_horizontal: editing?.mirror_horizontal || false,
      mirror_vertical: editing?.mirror_vertical || false,
      support_type: editing?.support_type || 'anydesk',
      support_id: editing?.support_id || null,
    };
    if (editing) {
      await fetch('/api/admin/crud/devices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...payload }) });
      await fetch('/api/admin/rpc/bump_device_content_version', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_device_id: editing.id }) }).catch(() => {});
    } else {
      await fetch('/api/admin/crud/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'inactive', is_activated: false }) });
    }
    resetForm(); setSaving(false); loadAll();
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
    await fetch('/api/admin/rpc/bump_device_content_version', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_device_id: id }) });
    loadAll();
  }

  async function restartDevice(id: string) {
    setActionMenuId(null);
    await fetch('/api/admin/crud/devices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restart_requested: true }) });
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Dispositivos</h1>
            <p className="text-sm text-gray-500 mt-1">{devices.length} registrado{devices.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Dispositivo
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

        {/* Search + View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, UUID ou modelo..."
              className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" />
          </div>
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
                              <button onClick={() => router.push(`/devices/${device.id}`)} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3">
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
                            <button onClick={() => router.push(`/devices/${device.id}`)} className="w-8 h-8 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-900/20 transition-colors" title="Detalhes">
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
                            <button onClick={() => { router.push(`/devices/${device.id}`); setActionMenuId(null); }}
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

        {/* Form Modal - Desktop sidebar / Mobile bottom sheet */}
        {showForm && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
            <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center">
              <div className="sm:bg-transparent sm:p-0 w-full sm:max-w-2xl">
                <form onSubmit={handleSave}
                  className="bg-gray-900 border border-gray-800 sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl">
                  {/* Form header */}
                  <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{editing ? 'Editar Dispositivo' : 'Novo Dispositivo'}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{editing ? 'Atualize as informações do dispositivo' : 'Preencha os dados para registrar um novo dispositivo'}</p>
                    </div>
                    <button type="button" onClick={resetForm} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-5">
                    {/* Basic info */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informações Básicas</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Nome *</label>
                          <input value={name} onChange={e => setName(e.target.value)} required
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" placeholder="Ex: TV Sala" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">UUID *</label>
                          <input value={deviceUuid} onChange={e => setDeviceUuid(e.target.value)} required
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" placeholder="ID do dispositivo" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Modelo</label>
                          <input value={model} onChange={e => setModel(e.target.value)}
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" placeholder="Ex: Samsung SM-X510" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Orientação</label>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setOrientation('landscape')}
                              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'landscape' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                              ↔ Horizontal
                            </button>
                            <button type="button" onClick={() => setOrientation('portrait')}
                              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'portrait' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                              ↕ Vertical
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Organization */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Organização & Unidade</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Organização *</label>
                          <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} required
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                            <option value="">Selecione...</option>
                            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Unidade</label>
                          <select value={unitId} onChange={e => setUnitId(e.target.value)}
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                            <option value="">Nenhuma</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Campaign & Layout */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campanha & Layout</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Campanha</label>
                          <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                            <option value="">Nenhuma (standby)</option>
                            {campaigns.filter(c => !organizationId || c.organization_id === organizationId).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Layout (Diagramação)</label>
                          <select value={layoutId} onChange={e => setLayoutId(e.target.value)}
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                            <option value="">Padrão (tela cheia)</option>
                            {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Screen settings */}
                    {editing && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Configurações de Tela</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Rotação</label>
                            <select value={editing.screen_rotation || 0}
                              onChange={e => setEditing({ ...editing, screen_rotation: +e.target.value })}
                              className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                              <option value={0}>0° (Normal)</option>
                              <option value={90}>90° (Esquerda)</option>
                              <option value={180}>180° (De cabeça)</option>
                              <option value={270}>270° (Direita)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Espelhamento</label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setEditing({ ...editing, mirror_horizontal: !editing.mirror_horizontal })}
                                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${editing.mirror_horizontal ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                                ↔ H
                              </button>
                              <button type="button" onClick={() => setEditing({ ...editing, mirror_vertical: !editing.mirror_vertical })}
                                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${editing.mirror_vertical ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                                ↕ V
                              </button>
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm text-gray-400 mb-1.5">Suporte Remoto</label>
                            <div className="flex gap-2">
                              <select value={editing.support_type || 'anydesk'}
                                onChange={e => setEditing({ ...editing, support_type: e.target.value })}
                                className="w-28 rounded-xl bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors">
                                <option value="anydesk">AnyDesk</option>
                                <option value="teamviewer">TeamViewer</option>
                                <option value="scrcpy">ScrCPy</option>
                              </select>
                              <input value={editing.support_id || ''} placeholder="ID do dispositivo"
                                onChange={e => setEditing({ ...editing, support_id: e.target.value })}
                                className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form footer */}
                  <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-end gap-3">
                    <button type="button" onClick={resetForm}
                      className="rounded-xl bg-gray-800 border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-750 hover:text-white transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={saving}
                      className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20">
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </span>
                      ) : editing ? 'Salvar Alterações' : 'Criar Dispositivo'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
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
      </div>
    </div>
  );
}
