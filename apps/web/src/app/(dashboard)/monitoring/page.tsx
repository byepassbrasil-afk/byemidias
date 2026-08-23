'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
}

export default function MonitoringPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const [devicesRes, logsRes] = await Promise.all([
      supabase.from('devices').select('*').order('name'),
      supabase.from('device_logs').select('*, devices(name)').order('created_at', { ascending: false }).limit(100),
    ]);
    setDevices(devicesRes.data ?? []);
    setLogs((logsRes.data ?? []) as DeviceLog[]);
    setLoading(false);
  }

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

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  }

  const filtered = filter === 'all' ? devices : devices.filter((d) => isOnline(d) === (filter === 'online'));
  const onlineCount = devices.filter(d => isOnline(d)).length;
  const offlineCount = devices.length - onlineCount;
  const filteredLogs = selectedDevice ? logs.filter(l => l.device_id === selectedDevice) : logs;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monitoramento</h1>
        <div className="flex gap-3 items-center">
          <select
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value || null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            <option value="">Todos dispositivos</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-green-200">
          <div className="text-sm text-green-600">Online</div>
          <div className="text-2xl font-bold text-green-700">{onlineCount}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-red-200">
          <div className="text-sm text-red-600">Offline</div>
          <div className="text-2xl font-bold text-red-700">{offlineCount}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <>
          {/* Devices Table */}
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Dispositivos</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Contato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((device) => {
                  const online = isOnline(device);
                  return (
                  <tr key={device.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDevice(device.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-medium ${online ? 'text-green-700' : 'text-red-700'}`}>{online ? 'Online' : 'Offline'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{device.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{device.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{timeSince(device.last_heartbeat)} atrás</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{device.player_version || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{device.ip_address || '—'}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Logs Table */}
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Logs de Atividade</h2>
              <span className="text-xs text-gray-400">{filteredLogs.length} registros</span>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensagem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum log registrado</td></tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-xs text-gray-500">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 font-medium">{(log.devices as any)?.name || log.device_id.slice(0, 8)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.event_type === 'error' ? 'bg-red-100 text-red-800' :
                        log.event_type === 'session_start' ? 'bg-blue-100 text-blue-800' :
                        log.event_type === 'session_end' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>{log.event_type}</span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">{log.message || '—'}</td>
                    <td className="px-6 py-3 text-xs text-gray-500 font-mono">{formatUptime(log.uptime_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
