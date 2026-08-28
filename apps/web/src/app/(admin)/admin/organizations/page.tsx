'use client';

import { useEffect, useState } from 'react';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  renewal_date: string | null;
  monthly_price: number;
  total_revenue: number;
  total_expenses: number;
  max_devices: number;
  owner_id: string | null;
  created_at: string;
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    try {
      const res = await fetch('/api/admin/crud/organizations?limit=500');
      if (!res.ok) throw new Error('Erro ao carregar');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrgs(Array.isArray(data.data) ? data.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editingOrg) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crud/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOrg.id, plan: editingOrg.plan, renewal_date: editingOrg.renewal_date,
          monthly_price: editingOrg.monthly_price, total_revenue: editingOrg.total_revenue,
          total_expenses: editingOrg.total_expenses, max_devices: editingOrg.max_devices, status: editingOrg.status,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setEditingOrg(null);
      loadOrgs();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const planLabel: Record<string, string> = { free: 'Gratuito', basic: 'Básico', pro: 'Profissional', enterprise: 'Empresarial' };

  function daysUntil(d: string | null) {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;
  if (error) return <div className="p-6 text-red-400">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizações</h1>
          <p className="text-sm text-gray-400">{orgs.length} organizações</p>
        </div>
        <input
          type="search"
          placeholder="Buscar organização..."
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
                <th className="text-left px-5 py-3">Organização</th>
                <th className="text-left px-5 py-3">Slug</th>
                <th className="text-left px-5 py-3">Plano</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Renovação</th>
                <th className="text-right px-5 py-3">Mensal</th>
                <th className="text-right px-5 py-3">Devices</th>
                <th className="text-left px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Nenhuma organização encontrada</td></tr>
              ) : filtered.map(org => {
                const days = daysUntil(org.renewal_date);
                const isExpired = days !== null && days < 0;
                const isExpiring = days !== null && days >= 0 && days <= 30;
                return (
                  <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-medium text-white">{org.name}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{org.slug}</td>
                    <td className="px-5 py-3">
                      <span className="bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full text-xs">
                        {planLabel[org.plan] || 'Gratuito'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        org.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        org.status === 'suspended' ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-400'
                      }`}>{org.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {org.renewal_date ? (
                        <span className={`text-xs ${isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {new Date(org.renewal_date).toLocaleDateString('pt-BR')}
                          {isExpired ? ' (expirada)' : isExpiring ? ` (${days}d)` : ''}
                        </span>
                      ) : <span className="text-xs text-gray-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">R$ {org.monthly_price?.toFixed(2) || '0.00'}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{org.max_devices}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setEditingOrg(org)} className="text-blue-400 hover:text-blue-300 text-xs font-medium">Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingOrg(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Editar — {editingOrg.name}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Plano</label>
                  <select value={editingOrg.plan || 'free'} onChange={e => setEditingOrg({ ...editingOrg, plan: e.target.value })}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                    <option value="free">Gratuito</option><option value="basic">Básico</option><option value="pro">Profissional</option><option value="enterprise">Empresarial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={editingOrg.status} onChange={e => setEditingOrg({ ...editingOrg, status: e.target.value })}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                    <option value="active">Ativo</option><option value="inactive">Inativo</option><option value="suspended">Suspenso</option><option value="pending_approval">Pendente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Data de Renovação</label>
                <input type="date" value={editingOrg.renewal_date?.slice(0, 10) || ''}
                  onChange={e => setEditingOrg({ ...editingOrg, renewal_date: e.target.value || null })}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Preço Mensal (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.monthly_price || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, monthly_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Receita Total (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.total_revenue || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, total_revenue: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Despesas (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.total_expenses || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, total_expenses: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Máximo de Dispositivos</label>
                <input type="number" value={editingOrg.max_devices || 10}
                  onChange={e => setEditingOrg({ ...editingOrg, max_devices: parseInt(e.target.value) || 10 })}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditingOrg(null)} className="bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
