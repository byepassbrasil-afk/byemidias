'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SaasStats {
  total_orgs: number;
  active_orgs: number;
  expired_orgs: number;
  total_devices: number;
  online_devices: number;
  active_campaigns: number;
  total_media: number;
  total_users: number;
  monthly_revenue: number;
  total_revenue: number;
  total_expenses: number;
  profit: number;
}

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
  device_count: number;
  campaign_count: number;
  media_count: number;
  created_at: string;
}

export default function SaasDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<SaasStats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [expiring, setExpiring] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch('/api/admin/saas/stats');
      const data = await res.json();
      if (data.error) { router.push('/login'); return; }
      setStats(data.stats);
      setOrgs(data.organizations || []);
      setExpiring(data.expiring_soon || []);
    } catch {}
    setLoading(false);
  }

  async function handleSaveOrg() {
    if (!editingOrg) return;
    setSaving(true);
    await fetch('/api/admin/crud/organizations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingOrg.id,
        plan: editingOrg.plan,
        renewal_date: editingOrg.renewal_date,
        monthly_price: editingOrg.monthly_price,
        total_revenue: editingOrg.total_revenue,
        total_expenses: editingOrg.total_expenses,
        status: editingOrg.status,
        updated_at: new Date().toISOString(),
      }),
    });
    setEditingOrg(null);
    setSaving(false);
    loadData();
  }

  function formatCurrency(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function daysUntilRenewal(date: string | null) {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const planLabel: Record<string, string> = { free: 'Gratuito', basic: 'Básico', pro: 'Profissional', enterprise: 'Empresarial' };

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;
  if (!stats) return <div className="p-6 text-red-500">Erro ao carregar</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel SAAS</h1>
          <p className="text-sm text-gray-500">Gestão de organizações e assinaturas</p>
        </div>
        <button onClick={loadData} className="text-sm text-blue-600 hover:text-blue-800">↻ Atualizar</button>
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Receita Mensal</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(stats.monthly_revenue)}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Receita Total</div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(stats.total_revenue)}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Despesas Totais</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(stats.total_expenses)}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Lucro</div>
          <div className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats.profit)}</div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Organizações</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total_orgs}</div>
          <div className="text-[11px] text-green-600">{stats.active_orgs} ativas</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Dispositivos</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total_devices}</div>
          <div className="text-[11px] text-green-600">{stats.online_devices} online</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Campanhas Ativas</div>
          <div className="text-2xl font-bold text-gray-900">{stats.active_campaigns}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Mídias</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total_media}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500">Usuários</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
        </div>
      </div>

      {/* Expiring Soon */}
      {expiring.length > 0 && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Assinaturas expirando em breve</h3>
          <div className="space-y-1">
            {expiring.map(org => (
              <div key={org.id} className="flex items-center justify-between text-sm">
                <span className="text-yellow-700">{org.name}</span>
                <span className="text-yellow-600 text-xs">
                  expira em {daysUntilRenewal(org.renewal_date)} dias ({new Date(org.renewal_date!).toLocaleDateString('pt-BR')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations Table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Organizações ({orgs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organização</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renovação</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mensal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Devices</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Campanhas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orgs.map(org => {
                const days = daysUntilRenewal(org.renewal_date);
                const isExpired = days !== null && days < 0;
                const isExpiring = days !== null && days >= 0 && days <= 30;
                return (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{org.name}</div>
                      <div className="text-xs text-gray-400">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {planLabel[org.plan] || org.plan || 'Gratuito'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        org.status === 'active' ? 'bg-green-100 text-green-700' :
                        org.status === 'suspended' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{org.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {org.renewal_date ? (
                        <span className={`text-xs ${isExpired ? 'text-red-600 font-bold' : isExpiring ? 'text-yellow-600 font-medium' : 'text-gray-600'}`}>
                          {new Date(org.renewal_date).toLocaleDateString('pt-BR')}
                          {isExpired && ' (expirado)'}
                          {isExpiring && ` (${days}d)`}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(org.monthly_price)}</td>
                    <td className="px-4 py-3 text-right text-sm">{org.device_count}</td>
                    <td className="px-4 py-3 text-right text-sm">{org.campaign_count}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingOrg(org)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Org Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingOrg(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar — {editingOrg.name}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                  <select value={editingOrg.plan || 'free'} onChange={e => setEditingOrg({ ...editingOrg, plan: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="free">Gratuito</option>
                    <option value="basic">Básico</option>
                    <option value="pro">Profissional</option>
                    <option value="enterprise">Empresarial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editingOrg.status} onChange={e => setEditingOrg({ ...editingOrg, status: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="suspended">Suspenso</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Renovação</label>
                <input type="date" value={editingOrg.renewal_date?.slice(0, 10) || ''}
                  onChange={e => setEditingOrg({ ...editingOrg, renewal_date: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Mensal (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.monthly_price || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, monthly_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receita Total (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.total_revenue || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, total_revenue: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Despesas (R$)</label>
                  <input type="number" step="0.01" value={editingOrg.total_expenses || 0}
                    onChange={e => setEditingOrg({ ...editingOrg, total_expenses: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveOrg} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditingOrg(null)} className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-300">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
