'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

interface MapDevice {
  id: string;
  name: string;
  establishment_name?: string | null;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  is_activated: boolean;
  status: string;
  organization_name: string;
  organization_slug: string;
  primary_color: string;
  partner_name?: string;
  campaign_name?: string;
  last_heartbeat: string | null;
}

export default function DashboardMapPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard/map/devices');
      const d = await r.json();
      setDevices(d.devices ?? []);
    } catch (e) {
      console.error('Failed to load devices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function isOnline(last: string | null): boolean {
    if (!last) return false;
    return Date.now() - new Date(last).getTime() < 5 * 60 * 1000;
  }

  const selected = devices.find((d) => d.id === selectedId) || null;

  // Stats
  const total = devices.length;
  const online = devices.filter((d) => isOnline(d.last_heartbeat)).length;
  const offline = total - online;
  const activated = devices.filter((d) => d.is_activated).length;

  const center = devices.length > 0
    ? { latitude: devices[0].latitude, longitude: devices[0].longitude }
    : { latitude: -23.5505, longitude: -46.6333 };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa de Terminais</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Carregando...' : `${total} terminais cadastrados`}
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
        >
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-green-600">Online</p>
          <p className="text-2xl font-bold text-green-700">{online}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-red-600">Offline</p>
          <p className="text-2xl font-bold text-red-700">{offline}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-blue-600">Ativados</p>
          <p className="text-2xl font-bold text-blue-700">{activated}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Carregando…
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-700 mb-2 font-medium">Nenhum terminal com coordenadas cadastradas.</p>
          <p className="text-sm text-gray-500">
            Edite um terminal em <code className="bg-gray-100 px-2 py-0.5 rounded">Dispositivos</code> e clique em "Buscar" no campo endereço para preencher as coordenadas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <LeafletMap
              devices={devices}
              center={center}
              zoom={5}
              height="600px"
              markerColor="#3b82f6"
              onMarkerClick={(id) => setSelectedId(id)}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 max-h-[600px] overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Terminais ({devices.length})</h2>
            <div className="space-y-2">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left rounded-lg p-3 border transition-colors ${
                    selectedId === d.id
                      ? 'bg-orange-50 border-orange-500'
                      : 'bg-gray-50 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      {d.establishment_name && (
                        <p className="text-sm font-bold text-gray-900 truncate">🏢 {d.establishment_name}</p>
                      )}
                      <p className={`${d.establishment_name ? 'text-xs text-gray-600' : 'text-sm font-medium text-gray-900'} truncate`}>
                        {d.name}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${
                        isOnline(d.last_heartbeat)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      ● {isOnline(d.last_heartbeat) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{d.organization_name}</p>
                  <p className="text-xs text-gray-400 truncate mt-1">
                    📍 {d.address ? `${d.address}, ` : ''}{d.city || ''} {d.state || ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              {selected.establishment_name && (
                <p className="text-sm font-bold text-orange-600 flex items-center gap-1">
                  🏢 {selected.establishment_name}
                </p>
              )}
              <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
              <p className="text-xs text-gray-500">ID: {selected.id.slice(0, 8)}…</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Latitude</p>
              <p className="text-gray-900 font-mono">{Number(selected.latitude).toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Longitude</p>
              <p className="text-gray-900 font-mono">{Number(selected.longitude).toFixed(6)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">📍 Endereço</p>
              <p className="text-gray-900">{selected.address || '—'}</p>
              <p className="text-xs text-gray-600">{selected.city || '—'}{selected.state ? `/${selected.state}` : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-gray-900">{selected.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Último heartbeat</p>
              <p className="text-gray-900 text-xs">
                {selected.last_heartbeat ? new Date(selected.last_heartbeat).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push(`/dashboard/devices/${selected.id}`)}
              className="rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
            >
              Editar dispositivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
