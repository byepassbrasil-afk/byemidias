'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Device } from '@/lib/types';

interface Campaign { id: string; name: string; status: string; organization_id?: string; }
interface LayoutTemplate { id: string; name: string; }

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [layouts, setLayouts] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [campaignId, setCampaignId] = useState('');
  const [layoutId, setLayoutId] = useState('');

  // Quick campaign assign
  const [quickAssignDevice, setQuickAssignDevice] = useState<Device | null>(null);

  const supabase = createClient();

  const loadAll = useCallback(async () => {
    const [devRes, orgRes, unitRes, campRes, layRes] = await Promise.all([
      supabase.from('devices').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('id, name'),
      supabase.from('units').select('id, name'),
      supabase.from('campaigns').select('id, name, status, organization_id').in('status', ['active', 'draft', 'paused']),
      fetch('/api/admin/layouts').then(r => r.json()).catch(() => ({ templates: [] })),
    ]);
    setDevices(devRes.data ?? []);
    setOrgs((orgRes.data ?? []) as { id: string; name: string }[]);
    setUnits((unitRes.data ?? []) as { id: string; name: string }[]);
    setCampaigns((campRes.data ?? []) as Campaign[]);
    setLayouts((layRes.templates ?? []) as LayoutTemplate[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, [loadAll]);

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
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      name, model: model || null, device_uuid: deviceUuid,
      organization_id: organizationId, unit_id: unitId || null,
      orientation, updated_at: new Date().toISOString(),
      campaign_id: campaignId || null,
      layout_template_id: layoutId || null,
      screen_rotation: editing?.screen_rotation || 0,
      mirror_horizontal: editing?.mirror_horizontal || false,
      mirror_vertical: editing?.mirror_vertical || false,
      support_type: editing?.support_type || 'anydesk',
      support_id: editing?.support_id || null,
    };
    if (editing) {
      await supabase.from('devices').update(payload).eq('id', editing.id);
      // Bump content_version so device re-syncs
      const { error: rpcErr } = await supabase.rpc('bump_device_content_version' as never, { target_device_id: editing.id } as never);
      if (rpcErr) {
        await supabase.from('devices').update({ content_version: Date.now() % 100000 }).eq('id', editing.id);
      }
    } else {
      await supabase.from('devices').insert({ ...payload, status: 'inactive', is_activated: false });
    }
    resetForm(); setSaving(false); loadAll();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('devices').delete().eq('id', deleteId);
    setDeleteId(null); loadAll();
  }

  async function quickAssignCampaign(deviceId: string, campId: string | null) {
    await supabase.from('devices').update({ campaign_id: campId, content_version: Date.now() % 100000, updated_at: new Date().toISOString() }).eq('id', deviceId);
    loadAll();
  }

  async function forceSyncDevice(deviceId: string) {
    await supabase.rpc('bump_device_content_version' as never, { target_device_id: deviceId } as never);
    loadAll();
  }

  async function restartDevice(deviceId: string) {
    await supabase.from('devices').update({ restart_requested: true } as never).eq('id', deviceId);
    alert('Reinicio solicitado. O dispositivo reiniciara no proximo heartbeat.');
  }

  function isOnline(device: Device): boolean {
    if (!device.last_heartbeat) return false;
    const diff = Date.now() - new Date(device.last_heartbeat).getTime();
    return diff < 5 * 60 * 1000;
  }

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  function getCampaignName(id: string | null) {
    if (!id) return null;
    return campaigns.find(c => c.id === id)?.name || null;
  }

  function getLayoutName(id: string | null) {
    if (!id) return null;
    return layouts.find(l => l.id === id)?.name || null;
  }

  // Quick assign view
  if (quickAssignDevice) {
    const deviceCampaigns = campaigns.filter(c => c.organization_id === quickAssignDevice.organization_id);
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setQuickAssignDevice(null)} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
          <div>
            <h1 className="text-2xl font-bold">Campanha — {quickAssignDevice.name}</h1>
            <p className="text-sm text-gray-500">Selecione a campanha que este dispositivo deve reproduzir</p>
          </div>
        </div>
        <div className="space-y-3">
          <div
            className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
              !quickAssignDevice.campaign_id ? 'bg-gray-100 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => quickAssignCampaign(quickAssignDevice.id, null)}
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Nenhuma campanha</h3>
              <p className="text-xs text-gray-500">Dispositivo não reproduz nada</p>
            </div>
            {!quickAssignDevice.campaign_id && <span className="text-green-600 font-medium text-sm">✓ Selecionado</span>}
          </div>
          {deviceCampaigns.map(c => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
                quickAssignDevice.campaign_id === c.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => quickAssignCampaign(quickAssignDevice.id, c.id)}
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                  c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>{c.status}</span>
              </div>
              {quickAssignDevice.campaign_id === c.id && <span className="text-blue-600 font-medium text-sm">✓ Selecionado</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dispositivos</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Novo Dispositivo</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">{editing ? 'Editar Dispositivo' : 'Novo Dispositivo'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">UUID</label>
              <input value={deviceUuid} onChange={e => setDeviceUuid(e.target.value)} required
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white font-mono" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Modelo</label>
              <input value={model} onChange={e => setModel(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Organização</label>
              <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} required
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="">Selecione...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidade</label>
              <select value={unitId} onChange={e => setUnitId(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="">Nenhuma</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Orientação</label>
              <select value={orientation} onChange={e => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rotação da Tela</label>
              <select value={editing?.screen_rotation || 0}
                onChange={e => { if (editing) setEditing({ ...editing, screen_rotation: +e.target.value }); }}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value={0}>0° (Normal)</option>
                <option value={90}>90° (Girar Esquerda)</option>
                <option value={180}>180° (De cabeça)</option>
                <option value={270}>270° (Girar Direita)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Espelhamento</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => editing && setEditing({ ...editing, mirror_horizontal: !editing.mirror_horizontal })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${editing?.mirror_horizontal ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  ↔ Horizontal
                </button>
                <button type="button" onClick={() => editing && setEditing({ ...editing, mirror_vertical: !editing.mirror_vertical })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${editing?.mirror_vertical ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  ↕ Vertical
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Suporte Remoto</label>
              <div className="flex gap-2">
                <select value={editing?.support_type || 'anydesk'}
                  onChange={e => editing && setEditing({ ...editing, support_type: e.target.value })}
                  className="w-24 rounded-lg bg-gray-800 border border-gray-700 px-2 py-2 text-white text-xs">
                  <option value="anydesk">AnyDesk</option>
                  <option value="teamviewer">TeamViewer</option>
                  <option value="scrcpy">ScrCPy</option>
                </select>
                <input value={editing?.support_id || ''} placeholder="ID do dispositivo"
                  onChange={e => editing && setEditing({ ...editing, support_id: e.target.value })}
                  className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white font-mono text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Campanha</label>
              <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="">Nenhuma (não reproduz)</option>
                {campaigns.filter(c => !organizationId || c.organization_id === organizationId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Layout (Diagramação)</label>
              <select value={layoutId} onChange={e => setLayoutId(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="">Padrão (tela cheia)</option>
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={resetForm}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">Cancelar</button>
          </div>
        </form>
      )}

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-900/30 p-6 border border-red-800">
          <p className="text-sm text-red-300 mb-3">Tem certeza que deseja excluir este dispositivo?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-12 text-center">
          <p className="text-gray-500">Nenhum dispositivo encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campanha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Layout</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heartbeat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versão</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {devices.map(device => {
                const online = isOnline(device);
                const campName = getCampaignName(device.campaign_id);
                const layName = getLayoutName(device.layout_template_id);
                return (
                <tr key={device.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className={`text-xs font-medium ${online ? 'text-green-400' : 'text-red-400'}`}>{online ? 'Online' : 'Offline'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{device.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{device.device_uuid?.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    {campName ? (
                      <span className="inline-flex rounded-full bg-blue-900/50 px-2.5 py-0.5 text-xs font-medium text-blue-300">{campName}</span>
                    ) : (
                      <span className="text-xs text-gray-600 italic">Sem campanha</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{layName || 'Padrão'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {device.last_heartbeat ? `${timeSince(device.last_heartbeat)} atrás` : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{device.player_version || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => forceSyncDevice(device.id)}
                      className="text-yellow-400 hover:text-yellow-300 text-xs font-medium mr-1" title="Forcar sync">⚡</button>
                    <button onClick={() => restartDevice(device.id)}
                      className="text-orange-400 hover:text-orange-300 text-xs font-medium mr-1" title="Reiniciar APK">🔄</button>
                    <button onClick={() => router.push(`/devices/${device.id}`)}
                      className="text-green-400 hover:text-green-300 text-xs font-medium mr-1">Detalhes</button>
                    <button onClick={() => setQuickAssignDevice(device)}
                      className="text-purple-400 hover:text-purple-300 text-xs font-medium mr-1">Campanha</button>
                    <button onClick={() => startEdit(device)}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium mr-1">Editar</button>
                    <button onClick={() => setDeleteId(device.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium">Excluir</button>
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
