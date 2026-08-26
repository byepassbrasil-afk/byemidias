'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Device } from '@/lib/types';

interface DeviceLog {
  id: string;
  device_id: string;
  event_type: string;
  message: string | null;
  uptime_seconds: number | null;
  created_at: string;
}

export default function MonitoringPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [liveDevice, setLiveDevice] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [liveDeviceName, setLiveDeviceName] = useState('');
  const liveInterval = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    const [devicesRes, logsRes] = await Promise.all([
      fetch('/api/admin/crud/devices?order=name&asc=true'),
      fetch(`/api/admin/device-logs?limit=100${selectedDevice ? `&device_id=${selectedDevice}` : ''}`),
    ]);
    const devicesJson = await devicesRes.json();
    const logsJson = await logsRes.json();
    setDevices(devicesJson.data ?? []);
    setLogs(logsJson.data ?? []);
    setLoading(false);
  }, [selectedDevice]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const startLive = useCallback(async (deviceId: string) => {
    setLiveDevice(deviceId);
    setLiveFrame(null);
    const device = devices.find(d => d.id === deviceId);
    setLiveDeviceName(device?.name || 'Dispositivo');

    await fetch('/api/device/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, action: 'start' }),
    });

    if (liveInterval.current) clearInterval(liveInterval.current);
    liveInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/device/live?device_id=${deviceId}`);
        const data = await res.json();
        if (data.frame) setLiveFrame(data.frame);
      } catch {}
    }, 1500);
  }, [devices]);

  const stopLive = useCallback(async () => {
    if (liveDevice) {
      await fetch('/api/device/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: liveDevice, action: 'stop' }),
      }).catch(() => {});
    }
    if (liveInterval.current) { clearInterval(liveInterval.current); liveInterval.current = null; }
    setLiveDevice(null);
    setLiveFrame(null);
  }, [liveDevice]);

  useEffect(() => {
    return () => {
      if (liveInterval.current) clearInterval(liveInterval.current);
      if (liveDevice) {
        fetch('/api/device/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: liveDevice, action: 'stop' }),
        }).catch(() => {});
      }
    };
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
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }

  const filtered = filter === 'all' ? devices : devices.filter(d => isOnline(d) === (filter === 'online'));
  const onlineCount = devices.filter(d => isOnline(d)).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Monitoramento</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{devices.length}</div>
        </div>
        <div className="rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-green-200">
          <div className="text-xs text-green-600">Online</div>
          <div className="text-xl sm:text-2xl font-bold text-green-700">{onlineCount}</div>
        </div>
        <div className="rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-red-200">
          <div className="text-xs text-red-600">Offline</div>
          <div className="text-xl sm:text-2xl font-bold text-red-700">{offlineCount}</div>
        </div>
      </div>

      {liveDevice && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white text-sm font-medium">🔴 LIVE — {liveDeviceName}</span>
              <span className="text-gray-400 text-xs">• atualiza a cada 1.5s • sem storage</span>
            </div>
            <button onClick={stopLive} className="text-gray-400 hover:text-white text-xs bg-gray-800 px-3 py-1 rounded-lg">
              Fechar Live
            </button>
          </div>
          {liveFrame ? (
            <img src={liveFrame} alt="Live" className="w-full max-h-[65vh] object-contain rounded-lg" />
          ) : (
            <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 text-sm">
              Conectando ao dispositivo...
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={selectedDevice || ''} onChange={e => setSelectedDevice(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Todos dispositivos</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filter} onChange={e => setFilter(e.target.value)}
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
              {filtered.map(device => {
                const online = isOnline(device);
                return (
                  <div key={device.id} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0" onClick={() => setSelectedDevice(device.id)}>
                      <div className="text-sm font-medium text-gray-900 truncate">{device.name}</div>
                      <div className="text-xs text-gray-400">
                        {timeSince(device.last_heartbeat)} atrás • v{device.player_version?.slice(0, 10) || '—'}
                      </div>
                    </div>
                    {online && (
                      <button onClick={() => startLive(device.id)}
                        className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                        🔴 Ver Tela
                      </button>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dispositivo</div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Logs</h2>
              <span className="text-xs text-gray-400">{logs.length}</span>
            </div>
            <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum log</div>
              ) : logs.map(log => (
                <div key={log.id} className="px-4 py-2 flex items-start gap-2 text-sm">
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                    log.event_type === 'error' ? 'bg-red-100 text-red-800' :
                    log.event_type === 'session_start' ? 'bg-blue-100 text-blue-800' :
                    log.event_type === 'session_end' ? 'bg-gray-100 text-gray-800' :
                    'bg-green-100 text-green-800'
                  }`}>{log.event_type}</span>
                  <span className="text-gray-600 truncate">{log.message || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
