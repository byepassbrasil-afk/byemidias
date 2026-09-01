'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Device } from '@/lib/types';

interface Campaign { id: string; name: string; status: string; }
interface LayoutTemplate { id: string; name: string; }
interface DeviceLog { id: string; event_type: string; message: string | null; uptime_seconds: number | null; player_version: string | null; created_at: string; }

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [layouts, setLayouts] = useState<LayoutTemplate[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'campaign' | 'layout' | 'logs'>('info');
  const [saving, setSaving] = useState(false);

  // Edit state
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [campaignId, setCampaignId] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const loadData = useCallback(async () => {
    const [devRes, logRes, layRes] = await Promise.all([
      fetch(`/api/admin/crud/devices?id=${deviceId}`),
      fetch(`/api/admin/device-logs?device_id=${deviceId}&limit=50`),
      fetch('/api/admin/layouts').then(r => r.json()).catch(() => ({ templates: [] })),
    ]);

    const devJson = await devRes.json();
    const logJson = await logRes.json();

    if (devJson.data?.[0]) {
      const d = devJson.data[0] as Device;
      setDevice(d);
      setName(d.name); setModel(d.model || '');
      setOrientation(d.orientation || 'landscape');
      setCampaignId(d.campaign_id || '');
      setLayoutId(d.layout_template_id || '');
      setUnitId(d.unit_id || '');
      setAddress(d.address || '');
      setCity(d.city || '');
      setState(d.state || '');
      setLatitude(d.latitude != null ? Number(d.latitude) : null);
      setLongitude(d.longitude != null ? Number(d.longitude) : null);

      // Load campaigns for this organization
      const campRes = await fetch(`/api/admin/crud/campaigns?organization_id=${d.organization_id}`);
      const campJson = await campRes.json();
      const allCampaigns = (campJson.data ?? []) as Campaign[];
      setCampaigns(allCampaigns.filter(c => ['active', 'draft', 'paused'].includes(c.status)));
    }
    setLayouts((layRes.templates ?? []) as LayoutTemplate[]);
    setLogs((logJson.data ?? []) as DeviceLog[]);
    setLoading(false);
  }, [deviceId]);

  useEffect(() => { loadData(); }, [loadData]);

  function isOnline(): boolean {
    if (!device?.last_heartbeat) return false;
    return Date.now() - new Date(device.last_heartbeat).getTime() < 5 * 60 * 1000;
  }

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  async function saveField(field: string, value: unknown) {
    setSaving(true);
    await fetch('/api/admin/crud/devices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deviceId, [field]: value, updated_at: new Date().toISOString() }),
    });
    await fetch('/api/admin/rpc/bump_device_content_version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_device_id: deviceId }),
    });
    setSaving(false);
    loadData();
  }

  async function forceSync() {
    setSaving(true);
    await fetch('/api/admin/rpc/bump_device_content_version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_device_id: deviceId }),
    });
    setSaving(false);
    loadData();
  }

  async function geocodeAddress() {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(`${address}, ${city}, ${state}, Brasil`)}`);
      const d = await r.json();
      if (d.error) {
        alert('Endereço não encontrado. Verifique ou preencha lat/lng manualmente.');
      } else {
        setLatitude(d.latitude);
        setLongitude(d.longitude);
        if (d.display_name) {
          // Try to extract city/state from display_name
          const parts = d.display_name.split(',').map((s: string) => s.trim());
          if (parts.length >= 2 && !city) setCity(parts[parts.length - 3] || '');
          if (parts.length >= 1 && !state) setState(parts[parts.length - 2] || '');
        }
      }
    } catch {
      alert('Erro no geocoding');
    } finally {
      setGeocoding(false);
    }
  }

  async function saveLocation() {
    setSaving(true);
    try {
      await fetch(`/api/admin/devices/${deviceId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude, longitude,
          address: address || null,
          city: city || null,
          state: state || null,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    await fetch('/api/admin/crud/devices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: deviceId,
        name, model: model || null, orientation, campaign_id: campaignId || null,
        layout_template_id: layoutId || null, unit_id: unitId || null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (latitude != null && longitude != null) {
      await fetch(`/api/admin/devices/${deviceId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude, longitude,
          address: address || null,
          city: city || null,
          state: state || null,
        }),
      });
    }
    await fetch('/api/admin/rpc/bump_device_content_version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_device_id: deviceId }),
    });
    setSaving(false);
    loadData();
  }

  if (loading) return <div className="text-gray-500">Carregando...</div>;
  if (!device) return <div className="text-gray-500">Dispositivo não encontrado</div>;

  const online = isOnline();
  const uptime = device.last_heartbeat ? timeSince(device.last_heartbeat) : 'Nunca';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/devices')} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{device.model || 'Modelo desconhecido'} · UUID: {device.device_uuid?.slice(0, 12)}...</p>
        </div>
        <button onClick={forceSync} disabled={saving}
          className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50">
          {saving ? 'Enviando...' : '⚡ Forçar Sync'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {(['info', 'campaign', 'layout', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t === 'info' ? 'Informações' : t === 'campaign' ? 'Campanha' : t === 'layout' ? 'Layout' : 'Logs'}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Configurações do Dispositivo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Modelo</label>
              <input value={model} onChange={e => setModel(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Orientação</label>
              <select value={orientation} onChange={e => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <p className={`text-sm font-medium ${online ? 'text-green-400' : 'text-red-400'}`}>{online ? 'Online' : 'Offline'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Último heartbeat</span>
              <p className="text-sm text-white">{device.last_heartbeat ? `${timeSince(device.last_heartbeat)} atrás` : 'Nunca'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Versão</span>
              <p className="text-sm text-white font-mono">{device.player_version || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Resolução</span>
              <p className="text-sm text-white font-mono">{device.resolution || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Content Version</span>
              <p className="text-sm text-white font-mono">{device.content_version}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">UUID</span>
              <p className="text-sm text-white font-mono">{device.device_uuid}</p>
            </div>
          </div>

          {/* Localização / Mapa */}
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-3">📍 Localização (para o mapa de terminais)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Endereço</label>
                <div className="flex gap-2">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => address.trim() && latitude == null && geocodeAddress()}
                    placeholder="Ex: Av. Paulista 1000"
                    className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={geocoding || !address.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {geocoding ? '...' : '🔍 Buscar'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                <input value={city} onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <input value={state} onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                <input type="number" step="0.000001" value={latitude ?? ''}
                  onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                <input type="number" step="0.000001" value={longitude ?? ''}
                  onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white font-mono" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Digite endereço e clique em "Buscar" para preencher lat/lng automaticamente (Nominatim OSM).
              Se já tiver coordenadas, é só digitar manualmente.
            </p>
          </div>

          <button onClick={saveAll} disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      )}

      {/* Campaign Tab */}
      {tab === 'campaign' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Selecione a campanha que este dispositivo deve reproduzir.</p>
          <div
            className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
              !campaignId ? 'bg-gray-100 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => { setCampaignId(''); saveField('campaign_id', null); }}
          >
            <div>
              <h3 className="text-sm font-semibold">Nenhuma campanha</h3>
              <p className="text-xs text-gray-500">Dispositivo não reproduz nada</p>
            </div>
            {!campaignId && <span className="text-green-600 font-medium text-sm">✓ Selecionado</span>}
          </div>
          {campaigns.map(c => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
                campaignId === c.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => { setCampaignId(c.id); saveField('campaign_id', c.id); }}
            >
              <div>
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                  c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>{c.status}</span>
              </div>
              {campaignId === c.id && <span className="text-blue-600 font-medium text-sm">✓ Selecionado</span>}
            </div>
          ))}
        </div>
      )}

      {/* Layout Tab */}
      {tab === 'layout' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Selecione o layout de diagramação que este dispositivo deve usar.</p>
          <div
            className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
              !layoutId ? 'bg-gray-100 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => { setLayoutId(''); saveField('layout_template_id', null); }}
          >
            <div>
              <h3 className="text-sm font-semibold">Tela Cheia (Padrão)</h3>
              <p className="text-xs text-gray-500">Mídia ocupa toda a tela</p>
            </div>
            {!layoutId && <span className="text-green-600 font-medium text-sm">✓ Selecionado</span>}
          </div>
          {layouts.map(l => (
            <div
              key={l.id}
              className={`rounded-xl border p-4 flex items-center justify-between cursor-pointer transition-colors ${
                layoutId === l.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => { setLayoutId(l.id); saveField('layout_template_id', l.id); }}
            >
              <div>
                <h3 className="text-sm font-semibold">{l.name}</h3>
              </div>
              {layoutId === l.id && <span className="text-blue-600 font-medium text-sm">✓ Selecionado</span>}
            </div>
          ))}
        </div>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <div className="rounded-xl bg-gray-900 border border-gray-800">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Logs de Atividade</h2>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Nenhum log encontrado</div>
            ) : logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    log.event_type === 'heartbeat' ? 'bg-green-400' :
                    log.event_type === 'disconnect' ? 'bg-red-400' :
                    log.event_type === 'error' ? 'bg-yellow-400' : 'bg-blue-400'
                  }`} />
                  <div>
                    <span className="text-sm text-white capitalize">{log.event_type}</span>
                    {log.message && <span className="text-xs text-gray-400 ml-2">{log.message}</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-500">{timeSince(log.created_at)} atrás</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
