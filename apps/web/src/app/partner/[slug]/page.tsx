'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PartnerDeviceWithInfo } from '@/lib/types';

export default function PartnerSlugDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [devices, setDevices] = useState<PartnerDeviceWithInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDevices(); }, []);

  async function loadDevices() {
    try {
      const res = await fetch('/api/partner/devices');
      const data = await res.json();
      setDevices(data.devices ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function timeSince(date: string | null) {
    if (!date) return 'Nunca';
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  const onlineCount = devices.filter(d => {
    if (!d.device_last_heartbeat) return false;
    return Date.now() - new Date(d.device_last_heartbeat).getTime() < 5 * 60 * 1000;
  }).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral dos seus dispositivos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-2xl font-bold text-white">{devices.length}</div>
          <div className="text-xs text-gray-500 mt-1">Dispositivos</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <div className="text-2xl font-bold text-green-400">{onlineCount}</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">Online</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-2xl font-bold text-red-400">{devices.length - onlineCount}</div>
          <div className="text-xs text-gray-500 mt-1">Offline</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-gray-400 font-medium">Nenhum dispositivo atribuído</p>
          <p className="text-sm text-gray-600 mt-1">Entre em contato com o administrador</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(device => {
            const isOnline = device.device_last_heartbeat
              ? Date.now() - new Date(device.device_last_heartbeat).getTime() < 5 * 60 * 1000
              : false;
            return (
              <div key={device.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${isOnline ? 'bg-green-900/40 text-green-400 ring-1 ring-green-600/30' : 'bg-gray-800 text-gray-500'}`}>
                      {device.device_name?.slice(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{device.device_name}</h3>
                      <p className="text-[11px] text-gray-600 font-mono">{device.device_uuid?.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${isOnline ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
                {device.playlist_name && (
                  <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-400">
                    📋 {device.playlist_name}
                  </div>
                )}
                <p className="text-[11px] text-gray-600 mt-3">
                  Último contato: {device.device_last_heartbeat ? `${timeSince(device.device_last_heartbeat)} atrás` : 'Nunca'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
