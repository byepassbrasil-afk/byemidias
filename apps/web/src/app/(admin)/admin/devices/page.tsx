'use client';

import { useEffect, useState } from 'react';

interface Device {
  id: string;
  name: string;
  serial: string;
  status: string;
  campaign_id: string | null;
  campaign_name?: string;
  organization_id: string | null;
  org_name?: string;
  last_heartbeat: string | null;
  device_type: string | null;
  content_version: number;
  created_at: string;
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadDevices(); }, []);

  async function loadDevices() {
    try {
      const res = await fetch('/api/admin/crud/devices?limit=500');
      const data = await res.json();
      setDevices(data.data || []);
    } catch {}
    setLoading(false);
  }

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.serial.toLowerCase().includes(search.toLowerCase())
  );

  function isOnline(d: Device) {
    if (!d.last_heartbeat) return false;
    return Date.now() - new Date(d.last_heartbeat).getTime() < 5 * 60 * 1000;
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispositivos</h1>
          <p className="text-sm text-gray-400">{devices.length} dispositivos</p>
        </div>
        <input
          type="search"
          placeholder="Buscar dispositivo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-white w-64"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Total</p>
          <p className="text-2xl font-bold text-white">{devices.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Online</p>
          <p className="text-2xl font-bold text-green-400">{devices.filter(d => isOnline(d)).length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Offline</p>
          <p className="text-2xl font-bold text-red-400">{devices.filter(d => !isOnline(d)).length}</p>
        </div>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Dispositivo</th>
                <th className="text-left px-5 py-3">Serial</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Campanha</th>
                <th className="text-left px-5 py-3">Org</th>
                <th className="text-left px-5 py-3">Último Heartbeat</th>
                <th className="text-left px-5 py-3">v{String.fromCharCode(100+3)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Nenhum dispositivo encontrado</td></tr>
              ) : filtered.map(device => {
                const online = isOnline(device);
                return (
                  <tr key={device.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-medium text-white">{device.name}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{device.serial}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{device.device_type || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1.5 text-xs ${online ? 'text-green-400' : 'text-red-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{device.campaign_name || device.campaign_id || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{device.org_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{device.content_version}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
