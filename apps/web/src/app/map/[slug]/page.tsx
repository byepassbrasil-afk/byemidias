'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

interface MapDevice {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  partner_name?: string;
  campaign_name?: string;
}

interface Organization {
  id: string;
  name: string;
  primary_color: string;
  default_latitude: number | null;
  default_longitude: number | null;
}

export default function PublicMapPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [org, setOrg] = useState<Organization | null>(null);
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/map/${slug}/devices`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setOrg(d.organization);
          setDevices(d.devices ?? []);
        }
      })
      .catch(() => setError('Erro de conexão'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando mapa…</p>
      </main>
    );
  }

  if (error || !org) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">😕 Ops</h1>
          <p className="text-gray-500">{error || 'Mapa não encontrado.'}</p>
        </div>
      </main>
    );
  }

  const center = {
    latitude: org.default_latitude ?? devices[0]?.latitude ?? -23.5505,
    longitude: org.default_longitude ?? devices[0]?.longitude ?? -46.6333,
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-6">
          <a
            href="/lp"
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 mb-3"
          >
            ← Powered by ByeMidias
          </a>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ color: org.primary_color }}
          >
            📍 {org.name}
          </h1>
          <p className="text-gray-600 text-sm">
            Rede de terminais de anúncio
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {devices.length} {devices.length === 1 ? 'terminal exibido' : 'terminais exibidos'}
          </p>
        </header>

        {devices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-500">
            Nenhum terminal com localização cadastrada ainda.
          </div>
        ) : (
          <LeafletMap
            devices={devices}
            center={center}
            zoom={6}
            height="550px"
            markerColor={org.primary_color}
          />
        )}

        <footer className="text-center text-xs text-gray-400 mt-6">
          Mapa público • Acesso via link • {devices.length} terminais ativos
        </footer>
      </div>
    </main>
  );
}
