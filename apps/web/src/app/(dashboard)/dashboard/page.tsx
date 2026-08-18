'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  active_campaigns: number;
  total_media: number;
  total_organizations: number;
  total_units: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    total_devices: 0,
    online_devices: 0,
    offline_devices: 0,
    active_campaigns: 0,
    total_media: 0,
    total_organizations: 0,
    total_units: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      const [devices, campaigns, media, orgs, units] = await Promise.all([
        supabase.from('devices').select('status', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('media').select('*', { count: 'exact', head: true }),
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        total_devices: devices.count ?? 0,
        online_devices: 0,
        offline_devices: 0,
        active_campaigns: campaigns.count ?? 0,
        total_media: media.count ?? 0,
        total_organizations: orgs.count ?? 0,
        total_units: units.count ?? 0,
      });
      setLoading(false);
    }

    loadStats();
  }, [supabase]);

  const cards = [
    { label: 'Total de Telas', value: stats.total_devices, color: 'bg-blue-500' },
    { label: 'Online', value: stats.online_devices, color: 'bg-green-500' },
    { label: 'Offline', value: stats.offline_devices, color: 'bg-red-500' },
    { label: 'Campanhas Ativas', value: stats.active_campaigns, color: 'bg-purple-500' },
    { label: 'Conteúdos', value: stats.total_media, color: 'bg-yellow-500' },
    { label: 'Organizações', value: stats.total_organizations, color: 'bg-indigo-500' },
    { label: 'Unidades', value: stats.total_units, color: 'bg-pink-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl bg-white p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${card.color}`}>
                  <span className="text-white text-lg font-bold">
                    {card.value}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
