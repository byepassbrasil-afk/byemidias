'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

interface MapDevice {
  id: string;
  name: string;
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

export default function AdminMapPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLoc, setEditingLoc] = useState<MapDevice | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/map/devices');
      const d = await r.json();
      setDevices(d.devices ?? []);
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
  const center = devices.length > 0
    ? { latitude: devices[0].latitude, longitude: devices[0].longitude }
    : { latitude: -23.5505, longitude: -46.6333 };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mapa de Terminais</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Carregando...' : `${devices.length} dispositivos com localização cadastrada`}
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-sm text-gray-300"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
          Carregando…
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-400 mb-2">Nenhum dispositivo com coordenadas ainda.</p>
          <p className="text-sm text-gray-600">
            Edite um dispositivo em <code className="bg-gray-800 px-2 py-0.5 rounded">/admin/devices/[id]</code> e clique em "Buscar" no campo endereço.
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
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 max-h-[600px] overflow-y-auto">
            <h2 className="text-sm font-bold text-white mb-3">Terminais ({devices.length})</h2>
            <div className="space-y-2">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left rounded-lg p-3 border transition-colors ${
                    selectedId === d.id
                      ? 'bg-blue-900/30 border-blue-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-white">{d.name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isOnline(d.last_heartbeat)
                          ? 'bg-green-900/40 text-green-300'
                          : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      ● {isOnline(d.last_heartbeat) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{d.organization_name}</p>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {d.address ? `${d.address}, ` : ''}{d.city || ''} {d.state || ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-4 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">{selected.name}</h2>
              <p className="text-xs text-gray-500">ID: {selected.id.slice(0, 8)}…</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Latitude</p>
              <p className="text-white font-mono">{Number(selected.latitude).toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Longitude</p>
              <p className="text-white font-mono">{Number(selected.longitude).toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Endereço</p>
              <p className="text-white">{selected.address || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cidade/UF</p>
              <p className="text-white">{selected.city || '—'}{selected.state ? `/${selected.state}` : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Organização</p>
              <p className="text-white">{selected.organization_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Parceiro</p>
              <p className="text-white">{selected.partner_name || '—'}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push(`/admin/devices/${selected.id}`)}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm text-white"
            >
              Editar dispositivo
            </button>
            <a
              href={`/map/${selected.organization_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-sm text-white"
            >
              Ver mapa público
            </a>
            <a
              href={`/lp/${selected.organization_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm text-white"
            >
              Ver landing
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
