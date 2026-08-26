'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Device } from '@/lib/types';

interface DeviceLog {
  id: string;
  device_id: string;
  event_type: string;
  message: string | null;
  uptime_seconds: number | null;
  player_version: string | null;
  created_at: string;
  devices?: { name: string } | null;
  device_name?: string | null;
}

interface ScreenshotDevice {
  id: string;
  name: string;
  last_screenshot: string | null;
  screenshot_updated_at: string | null;
}

export default function MonitoringPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotDevice[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [liveDevice, setLiveDevice] = useState<string | null>(null);
  const [liveImg, setLiveImg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [devicesRes, logsRes, ssRes] = await Promise.all([
      fetch('/api/admin/crud/devices?order=name&asc=true'),
      fetch(`/api/admin/device-logs?limit=100${selectedDevice ? `&device_id=${selectedDevice}` : ''}`),
      fetch('/api/device/screenshot'),
    ]);
    const devicesJson = await devicesRes.json();
    const logsJson = await logsRes.json();
    const ssJson = await ssRes.json();
    setDevices(devicesJson.data ?? []);
    setScreenshots(ssJson.devices ?? []);
    setLogs((logsJson.data ?? []).map((l: DeviceLog) => ({
      ...l,
      devices: (l as any).device_name ? { name: (l as any).device_name } : null,
    })));
    setLoading(false);
  }, [selectedDevice]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!liveDevice) { setLiveImg(null); return; }
    const poll = async () => {
      const res = await fetch(`/api/device/screenshot?device_id=${liveDevice}`);
      const data = await res.json();
      if (data.device?.last_screenshot) setLiveImg(data.device.last_screenshot);
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [liveDevice]);

  function isOnline(device: Device): boolean {
    if (!device.last_heartbeat) return false;
    return Date.now() - new Date(device.last_heartbeat).getTime() < 5 * 60 * 1000;
  }

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  function formatUptime(seconds: number | null) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  }

  const filtered = filter === 'all' ? devices : devices.filter((d) => isOnline(d) === (filter === 'online'));
  const onlineCount = devices.filter(d => isOnline(d)).length;
  const offlineCount = devices.length - onlineCount;
  const filteredLogs = selectedDevice ? logs.filter(l => l.device_id === selectedDevice) : logs;
  const liveDeviceInfo = devices.find(d => d.id === liveDevice);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Monitoramento</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-green-200">
          <div className="text-xs text-green-600">Online</div>
          <div className="text-2xl font-bold text-green-700">{onlineCount}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-red-200">
          <div className="text-xs text-red-600">Offline</div>
          <div className="text-2xl font-bold text-red-700">{offlineCount}</div>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">📺 Live Preview</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {devices.map(d => {
            const ss = screenshots.find(s => s.id === d.id);
            const hasScreenshot = !!ss?.last_screenshot;
            return (
              <button key={d.id} onClick={() => setLiveDevice(d.id)}
                className={`relative rounded-lg border-2 p-1 transition-all ${liveDevice === d.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
                {hasScreenshot ? (
                  <img src={ss!.last_screenshot!} alt={d.name} className="w-32 h-20 sm:w-40 sm:h-24 object-cover rounded" />
                ) : (
                  <div className="w-32 h-20 sm:w-40 sm:h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                    Sem preview
                  </div>
                )}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isOnline(d) ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-white bg-black/60 px-1 rounded truncate">{d.name}</span>
                </div>
              </button>
            );
          })}
        </div>

        {liveDevice && (
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white text-sm font-medium">{liveDeviceInfo?.name || 'Dispositivo'}</span>
                <span className="text-gray-400 text-xs">• Atualiza a cada 5s</span>
              </div>
              <button onClick={() => setLiveDevice(null)} className="text-gray-400 hover:text-white text-xs">Fechar</button>
            </div>
            {liveImg ? (
              <img src={liveImg!} alt="Live" className="w-full max-h-[60vh] object-contain rounded" />
            ) : (
              <div className="w-full h-48 bg-gray-800 rounded flex items-center justify-center text-gray-500">
                Aguardando screenshot...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={selectedDevice || ''} onChange={(e) => setSelectedDevice(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Todos dispositivos</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="all">Todos</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <>
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Dispositivos</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {filtered.map((device) => {
                const online = isOnline(device);
                return (
                  <div key={device.id} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelectedDevice(device.id)}>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{device.name}</div>
                      <div className="text-xs text-gray-400">{timeSince(device.last_heartbeat)} atrás • v{player_version_short(device.player_version)}</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-mono">{device.ip_address || '—'}</span>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dispositivo encontrado</div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Logs</h2>
              <span className="text-xs text-gray-400">{filteredLogs.length}</span>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum log</div>
              ) : filteredLogs.map((log) => (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                    log.event_type === 'error' ? 'bg-red-100 text-red-800' :
                    log.event_type === 'session_start' ? 'bg-blue-100 text-blue-800' :
                    log.event_type === 'session_end' ? 'bg-gray-100 text-gray-800' :
                    'bg-green-100 text-green-800'
                  }`}>{log.event_type}</span>
                  <span className="text-gray-700 truncate">{log.message || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function player_version_short(v: string | null | undefined) {
  if (!v) return '—';
  return v.length > 10 ? v.slice(0, 10) : v;
}
