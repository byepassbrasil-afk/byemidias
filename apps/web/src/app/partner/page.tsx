'use client';

import { useEffect, useState } from 'react';
import type { PartnerDeviceWithInfo } from '@byemidias/shared';

export default function PartnerDashboardPage() {
  const [devices, setDevices] = useState<PartnerDeviceWithInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const res = await fetch('/api/partner/devices');
      const data = await res.json();
      setDevices(data.devices ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    syncing: 'bg-yellow-500',
    error: 'bg-red-500',
    inactive: 'bg-gray-500',
  };

  const statusLabels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    syncing: 'Sincronizando',
    error: 'Erro',
    inactive: 'Inativo',
  };

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Meus Dispositivos</h1>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl bg-gray-800 p-12 text-center">
          <p className="text-gray-400">Nenhum dispositivo atribuído a você.</p>
          <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="rounded-xl bg-gray-800 border border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{device.device_name}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {device.device_uuid.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColors[device.device_status] ?? 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-400">
                    {statusLabels[device.device_status] ?? device.device_status}
                  </span>
                </div>
              </div>

              {device.playlist_name && (
                <div className="rounded-lg bg-gray-700/50 px-3 py-2 text-sm text-gray-300">
                  📋 {device.playlist_name}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3">
                Último contato: {timeSince(device.device_status === 'online' ? new Date().toISOString() : null)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
