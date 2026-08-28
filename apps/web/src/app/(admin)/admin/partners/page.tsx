'use client';

import { useEffect, useState } from 'react';

interface Partner {
  id: string;
  username: string;
  name: string;
  organization_id: string | null;
  org_name?: string;
  status: string;
  campaign_count?: number;
  device_count?: number;
  last_login: string | null;
  created_at: string;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadPartners(); }, []);

  async function loadPartners() {
    try {
      const res = await fetch('/api/admin/partners?limit=500');
      const data = await res.json();
      setPartners(data.data || []);
    } catch {}
    setLoading(false);
  }

  const filtered = partners.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400',
    inactive: 'bg-gray-800 text-gray-400',
    blocked: 'bg-red-900/50 text-red-400',
    pending: 'bg-yellow-900/50 text-yellow-400',
  };

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Parceiros</h1>
          <p className="text-sm text-gray-400">{partners.length} parceiros</p>
        </div>
        <input
          type="search"
          placeholder="Buscar parceiro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-white w-64"
        />
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Organização</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Dispositivos</th>
                <th className="text-left px-5 py-3">Último Login</th>
                <th className="text-left px-5 py-3">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Nenhum parceiro encontrado</td></tr>
              ) : filtered.map(partner => (
                <tr key={partner.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">{partner.username}</td>
                  <td className="px-5 py-3 text-gray-400">{partner.name || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{partner.org_name || partner.organization_id || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[partner.status] || statusColors.inactive}`}>
                      {partner.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{partner.device_count || 0}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {partner.last_login ? new Date(partner.last_login).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(partner.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
