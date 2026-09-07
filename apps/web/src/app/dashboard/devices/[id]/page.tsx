'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import CategoriesSection from '@/components/categories-section';
import OverridesSection from '@/components/overrides-section';

const LocationPicker = dynamic(() => import('@/components/location-picker'), { ssr: false });

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Unit {
  id: string;
  name: string;
  organization_id: string;
}

interface Campaign {
  id: string;
  name: string;
  organization_id: string;
}

interface Layout {
  id: string;
  name: string;
  organization_id: string;
}

interface Device {
  id: string;
  name: string;
  device_uuid: string | null;
  model: string | null;
  manufacturer: string | null;
  orientation: 'landscape' | 'portrait';
  status: string;
  is_activated: boolean;
  organization_id: string;
  unit_id: string | null;
  campaign_id: string | null;
  layout_template_id: string | null;
  screen_rotation: number;
  mirror_horizontal: boolean;
  mirror_vertical: boolean;
  support_id: string | null;
  support_type: string | null;
  api_base_url: string | null;
  video_player: 'native' | 'vlc' | 'exoplayer' | null;
  html_render: 'native' | 'webview' | null;
  image_fit_mode: string | null;
  image_rotation_lock: number | null;
  video_volume: number | null;
  auto_update: boolean | null;
  low_mem_restart: boolean | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  establishment_name: string | null;
}

export default function EditDevicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [name, setName] = useState('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [model, setModel] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [organizationId, setOrganizationId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [layoutId, setLayoutId] = useState('');

  // Location fields
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');

  // APK config fields
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [videoPlayer, setVideoPlayer] = useState<'native' | 'vlc' | 'exoplayer'>('exoplayer');
  const [htmlRender, setHtmlRender] = useState<'native' | 'webview'>('native');
  const [imageFitMode, setImageFitMode] = useState('centerCrop');
  const [imageRotationLock, setImageRotationLock] = useState(0);
  const [videoVolume, setVideoVolume] = useState(100);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lowMemRestart, setLowMemRestart] = useState(true);

  const [screenRotation, setScreenRotation] = useState(0);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [supportType, setSupportType] = useState('anydesk');
  const [supportId, setSupportId] = useState('');

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Load device
      const res = await fetch(`/api/admin/crud/devices?id=${id}`);
      const json = await res.json();
      const d: Device | undefined = json.data?.[0];
      if (!d) {
        setError('Dispositivo não encontrado');
        setLoading(false);
        return;
      }
      setDevice(d);
      setName(d.name);
      setDeviceUuid(d.device_uuid || '');
      setModel(d.model || '');
      setOrientation(d.orientation);
      setOrganizationId(d.organization_id);
      setUnitId(d.unit_id || '');
      setCampaignId(d.campaign_id || '');
      setLayoutId(d.layout_template_id || '');
      setScreenRotation(d.screen_rotation || 0);
      setMirrorH(d.mirror_horizontal || false);
      setMirrorV(d.mirror_vertical || false);
      setSupportType(d.support_type || 'anydesk');
      setSupportId(d.support_id || '');
      setApiBaseUrl(d.api_base_url || '');
      setVideoPlayer(d.video_player || 'exoplayer');
      setHtmlRender(d.html_render || 'native');
      setImageFitMode(d.image_fit_mode || 'centerCrop');
      setImageRotationLock(d.image_rotation_lock || 0);
      setVideoVolume(d.video_volume ?? 100);
      setAutoUpdate(d.auto_update ?? true);
      setLowMemRestart(d.low_mem_restart ?? true);
      setLatitude(d.latitude ?? null);
      setLongitude(d.longitude ?? null);
      setAddress(d.address ?? '');
      setCity(d.city ?? '');
      setState(d.state ?? '');
      setEstablishmentName(d.establishment_name ?? '');

      // Load orgs
      const orgsRes = await fetch('/api/admin/crud/organizations?order=name&asc=true');
      const orgsJson = await orgsRes.json();
      setOrgs(orgsJson.data ?? []);

      // Load units (filtered by org)
      const unitsRes = await fetch(`/api/admin/crud/units?organization_id=${d.organization_id}`);
      const unitsJson = await unitsRes.json();
      setUnits(unitsJson.data ?? []);

      // Load campaigns (filtered by org)
      const campaignsRes = await fetch(`/api/admin/crud/campaigns?organization_id=${d.organization_id}`);
      const campaignsJson = await campaignsRes.json();
      setCampaigns(campaignsJson.data ?? []);

      // Load layouts (filtered by org)
      const layoutsRes = await fetch(`/api/admin/crud/layout_templates?organization_id=${d.organization_id}`);
      const layoutsJson = await layoutsRes.json();
      setLayouts(layoutsJson.data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar';
      setError(msg);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/crud/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          device_uuid: deviceUuid,
          model,
          orientation,
          organization_id: organizationId,
          unit_id: unitId || null,
          campaign_id: campaignId || null,
          layout_template_id: layoutId || null,
          screen_rotation: screenRotation,
          mirror_horizontal: mirrorH,
          mirror_vertical: mirrorV,
          support_id: supportId || null,
          support_type: supportType,
          api_base_url: apiBaseUrl || null,
          video_player: videoPlayer,
          html_render: htmlRender,
          image_fit_mode: imageFitMode,
          image_rotation_lock: imageRotationLock,
          video_volume: videoVolume,
          auto_update: autoUpdate,
          low_mem_restart: lowMemRestart,
          latitude,
          longitude,
          address: address || null,
          city: city || null,
          state: state || null,
          establishment_name: establishmentName || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Erro ao salvar');
        setSaving(false);
        return;
      }

      setMessage('✓ Alterações salvas com sucesso!');
      setTimeout(() => router.push('/dashboard/devices'), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      setSaving(false);
    }
  }

  async function handleCommand(action: 'restart' | 'screenshot') {
    if (action === 'restart' && !confirm('Reiniciar o dispositivo agora?')) return;
    setMessage(`Solicitando ${action === 'restart' ? 'reinício' : 'screenshot'}...`);
    await fetch(`/api/dashboard/devices/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    setTimeout(() => setMessage(null), 3000);
  }

  async function sendRemoteCommand(command: string, label: string) {
    if (!confirm(`${label} agora no dispositivo?`)) return;
    setMessage(`📡 Enviando comando: ${label}...`);
    try {
      const res = await fetch(`/api/dashboard/devices/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage('❌ Erro: ' + (json.error || 'desconhecido'));
      } else {
        setMessage(`✅ Comando "${label}" enfileirado. Será executado no próximo heartbeat.`);
      }
    } catch (e: any) {
      setMessage('❌ Erro: ' + e.message);
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return;
    await fetch(`/api/admin/crud/devices?id=${id}`, { method: 'DELETE' });
    router.push('/dashboard/devices');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto text-gray-500 py-20 text-center">Carregando dispositivo...</div>
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/dashboard/devices" className="text-sm text-gray-400 hover:text-white">← Voltar para Dispositivos</Link>
          <div className="mt-6 text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard/devices" className="text-sm text-gray-400 hover:text-white">← Voltar para Dispositivos</Link>
            <h1 className="mt-2 text-2xl font-bold text-white">Editar Dispositivo</h1>
            <p className="text-sm text-gray-500">Atualize as informações e configurações do dispositivo</p>
          </div>
          {device && (
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${device.status === 'online' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {device.status}
            </span>
          )}
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-sm text-green-300">{message}</div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors"
                  placeholder="Ex: TV Sala" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">UUID *</label>
                <input value={deviceUuid} onChange={e => setDeviceUuid(e.target.value)} required
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors"
                  placeholder="UUID do dispositivo" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Modelo</label>
                <input value={model} onChange={e => setModel(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors"
                  placeholder="Ex: Samsung SM-X510" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Orientação</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOrientation('landscape')}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'landscape' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    ↔ Horizontal
                  </button>
                  <button type="button" onClick={() => setOrientation('portrait')}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${orientation === 'portrait' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    ↕ Vertical
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Organization & Unit */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Organização & Unidade</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Organização *</label>
                <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} required
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="">Selecione...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Unidade</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="">Nenhuma</option>
                  {units.filter(u => u.organization_id === organizationId).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Campaign & Layout */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Campanha & Layout</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Campanha</label>
                <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="">Nenhuma (standby)</option>
                  {campaigns.filter(c => c.organization_id === organizationId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Layout (Diagramação)</label>
                <select value={layoutId} onChange={e => setLayoutId(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="">Padrão (tela cheia)</option>
                  {layouts.filter(l => l.organization_id === organizationId).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Screen Config (mirrors APK) */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Configurações de Reprodução (espelha APK)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">URL do Servidor (API)</label>
                <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                  placeholder="https://byemidias.vercel.app"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Player de Vídeo</label>
                <select value={videoPlayer} onChange={e => setVideoPlayer(e.target.value as 'native' | 'vlc' | 'exoplayer')}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="exoplayer">ExoPlayer (recomendado)</option>
                  <option value="native">Nativo (VideoView)</option>
                  <option value="vlc">VLC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Renderização HTML</label>
                <select value={htmlRender} onChange={e => setHtmlRender(e.target.value as 'native' | 'webview')}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="native">Nativo</option>
                  <option value="webview">WebView</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Proporção Imagem/Vídeo</label>
                <select value={imageFitMode} onChange={e => setImageFitMode(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value="fill">Fill — Preencher (pode distorcer)</option>
                  <option value="centerCrop">CenterCrop — Preencher 100% cortando (recomendado DOOH)</option>
                  <option value="centerInside">CenterInside — Sem corte (letterbox)</option>
                  <option value="fitCenter">FitCenter — Sem distorção (letterbox)</option>
                  <option value="center">Center — Centralizado sem escala</option>
                  <option value="fit">Fit — Preencher esticando</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Rotação fixa da imagem</label>
                <select value={imageRotationLock} onChange={e => setImageRotationLock(+e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value={0}>0° (Normal)</option>
                  <option value={90}>90° (Esquerda)</option>
                  <option value={180}>180° (De cabeça)</option>
                  <option value={270}>270° (Direita)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Volume do Vídeo: <span className="text-orange-400 font-semibold">{videoVolume}%</span>
                </label>
                <input type="range" min={0} max={100} step={1}
                  value={videoVolume}
                  onChange={e => setVideoVolume(+e.target.value)}
                  className="w-full accent-orange-600" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Rotação do Display</label>
                <select value={screenRotation} onChange={e => setScreenRotation(+e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                  <option value={0}>0° (Normal)</option>
                  <option value={90}>90° (Esquerda)</option>
                  <option value={180}>180° (De cabeça)</option>
                  <option value={270}>270° (Direita)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Espelhamento</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMirrorH(!mirrorH)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${mirrorH ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    ↔ H
                  </button>
                  <button type="button" onClick={() => setMirrorV(!mirrorV)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${mirrorV ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    ↕ V
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Atualização Automática</label>
                <button type="button" onClick={() => setAutoUpdate(!autoUpdate)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${autoUpdate ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {autoUpdate ? '✓ Ativado' : '✕ Desativado'}
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Reinício Auto (memória baixa)</label>
                <button type="button" onClick={() => setLowMemRestart(!lowMemRestart)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${lowMemRestart ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {lowMemRestart ? '✓ Ativado' : '✕ Desativado'}
                </button>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Suporte Remoto</label>
                <div className="flex gap-2">
                  <select value={supportType} onChange={e => setSupportType(e.target.value)}
                    className="w-32 rounded-xl bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors">
                    <option value="anydesk">AnyDesk</option>
                    <option value="teamviewer">TeamViewer</option>
                    <option value="scrcpy">ScrCPy</option>
                  </select>
                  <input value={supportId} onChange={e => setSupportId(e.target.value)} placeholder="ID do dispositivo"
                    className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
                </div>
              </div>
            </div>
          </section>

          {/* Categories */}
          <CategoriesSection deviceId={id} />

          {/* Location */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Localização do Dispositivo</h2>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">🏢 Nome do Estabelecimento / Local</label>
                <input value={establishmentName} onChange={e => setEstablishmentName(e.target.value)}
                  placeholder="Ex: Shopping Center Norte - Loja 42"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Endereço</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Cidade</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">UF (Estado)</label>
                <input value={state} onChange={e => setState(e.target.value.toUpperCase())} maxLength={2}
                  placeholder="SP"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Latitude</label>
                <input type="number" step="any" value={latitude ?? ''}
                  onChange={e => setLatitude(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="-23.5505"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Longitude</label>
                <input type="number" step="any" value={longitude ?? ''}
                  onChange={e => setLongitude(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="-46.6333"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors" />
              </div>
            </div>

            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(parseFloat(lat.toFixed(7)));
                setLongitude(parseFloat(lng.toFixed(7)));
              }}
              height="350px"
              zoom={latitude && longitude ? 14 : 4}
            />

            <p className="mt-2 text-xs text-gray-500">
              💡 Pesquise um endereço, use seu GPS, ou clique diretamente no mapa para marcar a localização exata
            </p>
          </section>

          {/* Overrides */}
          <OverridesSection deviceId={id} />

          {/* Commands */}
          <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Comandos Remotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button type="button" onClick={() => handleCommand('restart')}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-medium text-white transition-colors">
                🔄 Forçar Reinício
              </button>
              <button type="button" onClick={() => handleCommand('screenshot')}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-3 text-sm font-medium text-white transition-colors">
                📸 Solicitar Screenshot
              </button>
              <button type="button" onClick={() => fetch(`/api/admin/rpc/bump_device_content_version`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_device_id: id }) }).then(() => setMessage('✓ Sync forçado!'))}
                className="rounded-xl bg-yellow-600 hover:bg-yellow-500 px-4 py-3 text-sm font-medium text-white transition-colors">
                ⚡ Forçar Sync
              </button>
              <button type="button" onClick={handleDelete}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-3 text-sm font-medium text-white transition-colors">
                🗑️ Excluir
              </button>
            </div>
          </section>

          {/* Controle Remoto */}
          <section className="rounded-2xl bg-gray-900 border border-orange-900/40 p-6">
            <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-1">📡 Controle Remoto (Espelho APK)</h2>
            <p className="text-xs text-gray-500 mb-4">Comandos executados no próximo heartbeat do dispositivo (até 30s).</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button type="button" onClick={() => sendRemoteCommand('open_config', 'Abrir Configurações')}
                className="rounded-xl bg-orange-600 border border-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-500 transition-colors">
                ⚙️ Abrir Config APK
              </button>
              <button type="button" onClick={() => sendRemoteCommand('rotate', 'Rotacionar Tela')}
                className="rounded-xl bg-blue-600 border border-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                🔄 Rotacionar (preview)
              </button>
              <button type="button" onClick={() => sendRemoteCommand('rotate_portrait', 'Forçar Vertical')}
                className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                ↕ Vertical
              </button>
              <button type="button" onClick={() => sendRemoteCommand('rotate_landscape', 'Forçar Horizontal')}
                className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                ↔ Horizontal
              </button>
              <button type="button" onClick={() => sendRemoteCommand('reload', 'Recarregar Conteúdo')}
                className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                🔃 Recarregar Sync
              </button>
              <button type="button" onClick={() => sendRemoteCommand('clear_cache', 'Limpar Cache')}
                className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                🗑️ Limpar Cache
              </button>
              <button type="button" onClick={() => sendRemoteCommand('toggle_kiosk', 'Toggle Kiosk')}
                className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                🔒 Toggle Kiosk
              </button>
              <button type="button" onClick={() => handleCommand('restart')}
                className="rounded-xl bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-900/60 transition-colors">
                ↻ Reiniciar App
              </button>
            </div>
          </section>

          {/* Footer actions */}
          <div className="sticky bottom-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.push('/dashboard/devices')}
              className="rounded-xl bg-gray-800 border border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-750 hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors shadow-lg shadow-orange-600/20">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
