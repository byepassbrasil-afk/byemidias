'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import LpShell from '@/components/lp-shell';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

interface OrgInfo {
  id: string;
  name: string;
  tagline: string | null;
  primary_color: string;
  default_latitude: number | null;
  default_longitude: number | null;
}

interface MapDevice {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

interface Stats {
  total_devices: number;
  visible_devices: number;
  cities: number;
  online_now: number;
}

export default function OrgLpPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/lp/${slug}/stats`).then((r) => r.json()),
      fetch(`/api/map/${slug}/devices`).then((r) => r.json()),
    ])
      .then(([statsData, mapData]) => {
        if (statsData.error) setError(statsData.error);
        else {
          setOrg(statsData.organization);
          setStats(statsData.stats);
        }
        if (!mapData.error) setDevices(mapData.devices ?? []);
      })
      .catch(() => setError('Erro de conexão'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando…</p>
      </main>
    );
  }

  if (error || !org) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">😕 Ops</h1>
          <p className="text-gray-500">{error || 'Organização não encontrada.'}</p>
        </div>
      </main>
    );
  }

  const center = devices[0]
    ? { latitude: devices[0].latitude, longitude: devices[0].longitude }
    : {
        latitude: org.default_latitude ?? -15.7801,
        longitude: org.default_longitude ?? -47.9292,
      };

  return (
    <LpShell
      variant="org"
      org={{
        name: org.name,
        tagline: org.tagline,
        primary_color: org.primary_color,
      }}
      stats={{
        total_devices: stats?.total_devices ?? 0,
        visible_devices: stats?.visible_devices ?? devices.length,
        cities: stats?.cities ?? 0,
      }}
      mapEmbed={
        devices.length > 0 ? (
          <LeafletMap
            devices={devices}
            center={center}
            zoom={5}
            height="400px"
            markerColor={org.primary_color}
          />
        ) : null
      }
    />
  );
}
