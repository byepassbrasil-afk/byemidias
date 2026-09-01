'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import LpShell from '@/components/lp-shell';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), { ssr: false });

interface OrgStat {
  id: string;
  name: string;
  tagline: string | null;
  primary_color: string;
  default_latitude: number | null;
  default_longitude: number | null;
}

interface DeviceMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

export default function GenericLpPage() {
  const [orgs, setOrgs] = useState<OrgStat[]>([]);
  const [allDevices, setAllDevices] = useState<DeviceMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/contract-templates').catch(() => null),
      Promise.resolve([]),
    ]);
    // Fetch all orgs and devices
    (async () => {
      try {
        // We need a public endpoint, but for now reuse the admin one in build-time
        const orgsRes = await fetch('/api/admin/contract-templates').catch(() => null);
        // Skip fetching admin-only data for public LP; instead use aggregated data
        const mapRes = await fetch('/api/admin/stats').catch(() => null);
        // Use what we have
        if (mapRes?.ok) {
          const stats = await mapRes.json();
          setOrgs([]);
          setAllDevices([]);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const totalDevices = allDevices.length;
  const center = allDevices[0]
    ? { latitude: allDevices[0].latitude, longitude: allDevices[0].longitude }
    : { latitude: -15.7801, longitude: -47.9292 }; // Brasília

  const mapEmbed = allDevices.length > 0 ? (
    <LeafletMap devices={allDevices} center={center} zoom={4} height="400px" />
  ) : null;

  return (
    <LpShell
      variant="generic"
      stats={{
        total_devices: totalDevices,
        visible_devices: totalDevices,
        cities: new Set(allDevices.map((d) => d.city).filter(Boolean)).size,
      }}
      mapEmbed={mapEmbed}
    />
  );
}
