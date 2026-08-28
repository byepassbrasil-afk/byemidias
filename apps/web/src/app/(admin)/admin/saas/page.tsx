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
  max_devices: number;
  device_count: number;
  campaign_count: number;
  media_count: number;
  created_at: string;
}

interface OnboardingForm {
  org_name: string;
  org_slug: string;
  plan: string;
  renewal_date: string;
  monthly_price: string;
  owner_name: string;
  owner_email: string;
}

export default function AdminSaasPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SaasStats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [expiring, setExpiring] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [saving, setSaving] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingForm>({
    org_name: '', org_slug: '', plan: 'pro', renewal_date: '', monthly_price: '', owner_name: '', owner_email: '',
  });
  const [onboardingResult, setOnboardingResult] = useState<{ temp_password: string; org_name: string; user_name: string; user_email: string } | null>(null);
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

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

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingLoading(true);
    setOnboardingError('');
    try {
      const orgRes = await fetch('/api/admin/crud/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: onboarding.org_name, slug: onboarding.org_slug, plan: onboarding.plan,
          renewal_date: onboarding.renewal_date || null,
          monthly_price: parseFloat(onboarding.monthly_price) || 0,
          status: 'active', max_devices: 10,
        }),
      });
      const orgData = await orgRes.json();
      if (orgData.error) { setOnboardingError(orgData.error); return; }
      const orgId = orgData.data?.id;

      const userRes = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: onboarding.owner_email, full_name: onboarding.owner_name,
          role: 'admin', organization_id: orgId,
        }),
      });
      const userData = await userRes.json();
      if (userData.error) { setOnboardingError(userData.error); return; }

      await fetch('/api/admin/crud/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orgId, owner_id: userData.user.id }),
      });

      setOnboardingResult({ temp_password: userData.temp_password, org_name: onboarding.org_name, user_name: onboarding.owner_name, user_email: onboarding.owner_email });
      loadData();
    } catch { setOnboardingError('Erro ao criar organização'); }
    setOnboardingLoading(false);
  }

  function resetOnboarding() {
    setShowOnboarding(false);
    setOnboardingResult(null);
    setOnboarding({ org_name: '', org_slug: '', plan: 'pro', renewal_date: '', monthly_price: '', owner_name: '', owner_email: '' });
  }

  async function handleSaveOrg() {
    if (!editingOrg) return;
    setSaving(true);
    await fetch('/api/admin/crud/organizations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingOrg.id, plan: editingOrg.plan, renewal_date: editingOrg.renewal_date,
        monthly_price: editingOrg.monthly_price, total_revenue: editingOrg.total_revenue,
        total_expenses: editingOrg.total_expenses, max_devices: editingOrg.max_devices, status: editingOrg.status,
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
          <h1 className="text-2xl font-bold text-white">Painel SAAS</h1>
          <p className="text-sm text-gray-400">Gestão de organizações e assinaturas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg">↻ Atualizar</button>
          <button onClick={() => setShowOnboarding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Nova Empresa
          </button>
        </div>
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-xs text-gray-400 mb-1">Receita Mensal</div>
          <div className="text-xl font-bold text-green-400">{formatCurrency(stats.monthly_revenue)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-xs text-gray-400 mb-1">Receita Total</div>
          <div className="text-xl font-bold text-blue-400">{formatCurrency(stats.total_revenue)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-xs text-gray-400 mb-1">Despesas Totais</div>
          <div className="text-xl font-bold text-red-400">{formatCurrency(stats.total_expenses)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-xs text-gray-400 mb-1">Lucro</div>
          <div className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(stats.profit)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Organizações', value: stats.total_orgs, sub: `${stats.active_orgs} ativas` },
          { label: 'Dispositivos', value: stats.total_devices, sub: `${stats.online_devices} online` },
          { label: 'Campanhas Ativas', value: stats.active_campaigns, sub: '' },
          { label: 'Mídias', value: stats.total_media, sub: '' },
          { label: 'Usuários', value: stats.total_users, sub: '' },
        ].map(card => (
          <div key={card.label} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="text-xs text-gray-400 mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            {card.sub && <div className="text-[11px] text-green-400 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Expiring soon */}
      {expiring.length > 0 && (
        <div className="rounded-xl bg-yellow-900/20 border border-yellow-800/50 p-4">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">⚠️ Assinaturas expirando em breve</h3>
          <div className="space-y-1">
            {expiring.map(org => (
              <div key={org.id} className="flex items-center justify-between text-sm">
                <span className="text-yellow-300">{org.name}</span>
                <span className="text-yellow-500 text-xs">
                  expira em {daysUntilRenewal(org.renewal_date)} dias ({new Date(org.renewal_date!).toLocaleDateString('pt-BR')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Organizações ({orgs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs">Organização</th>
                <th className="text-left px-5 py-3 text-xs">Plano</th>
                <th className="text-left px-5 py-3 text-xs">Status</th>
                <th className="text-left px-5 py-3 text-xs">Renovação</th>
                <th className="text-right px-5 py-3 text-xs">Mensal</th>
                <th className="text-right px-5 py-3 text-xs">Devices</th>
                <th className="text-right px-5 py-3 text-xs">Campanhas</th>
                <th className="text-left px-5 py-3 text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => {
                const days = daysUntilRenewal(org.renewal_date);
                const isExpired = days !== null && days < 0;
                const isExpiring = days !== null && days >= 0 && days <= 30;
                return (
                  <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-white">{org.name}</div>
                      <div className="text-xs text-gray-500">{org.slug}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">
                        {planLabel[org.plan] || org.plan || 'Gratuito'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        org.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        org.status === 'suspended' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>{org.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {org.renewal_date ? (
                        <span className={`text-xs ${isExpired ? 'text-red-400 font-bold' : isExpiring ? 'text-yellow-400 font-medium' : 'text-gray-400'}`}>
                          {new Date(org.renewal_date).toLocaleDateString('pt-BR')}
                          {isExpired && ' (expirado)'}
                          {isExpiring && ` (${days}d)`}
                        </span>
                      ) : <span className="text-xs text-gray-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">{formatCurrency(org.monthly_price)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{org.device_count}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{org.campaign_count}</td>
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

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !onboardingResult && resetOnboarding()}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {onboardingResult ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">✓</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Empresa criada com sucesso!</h3>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                  <div><span className="text-gray-400">Empresa:</span> <span className="font-medium text-white">{onboardingResult.org_name}</span></div>
                  <div><span className="text-gray-400">Usuário:</span> <span className="font-medium text-white">{onboardingResult.user_name}</span></div>
                  <div><span className="text-gray-400">Email:</span> <span className="font-medium text-white">{onboardingResult.user_email}</span></div>
                </div>
                <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 p-4 mb-2">
                  <p className="text-sm font-medium text-yellow-300 mb-2">Senha temporária do usuário:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-900 rounded px-3 py-2 text-sm font-mono text-white border border-gray-700">
                      {onboardingResult.temp_password}
                    </code>
                    <button onClick={() => navigator.clipboard.writeText(onboardingResult.temp_password)}
                      className="bg-yellow-700/50 hover:bg-yellow-600/50 px-3 py-2 rounded text-sm font-medium text-yellow-200">
                      Copiar
                    </button>
                  </div>
                </div>
                <button onClick={resetOnboarding} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleOnboard}>
                <h3 className="text-lg font-bold text-white mb-4">Nova Empresa</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nome da Empresa *</label>
                    <input value={onboarding.org_name} onChange={e => setOnboarding({ ...onboarding, org_name: e.target.value, org_slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })}
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" placeholder="Ex: DOOH-X" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Slug (URL)</label>
                    <input value={onboarding.org_slug} onChange={e => setOnboarding({ ...onboarding, org_slug: e.target.value })}
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" placeholder="doohx" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Plano</label>
                      <select value={onboarding.plan} onChange={e => setOnboarding({ ...onboarding, plan: e.target.value })}
                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                        <option value="free">Gratuito</option>
                        <option value="basic">Básico</option>
                        <option value="pro">Profissional</option>
                        <option value="enterprise">Empresarial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Preço Mensal (R$)</label>
                      <input type="number" step="0.01" value={onboarding.monthly_price} onChange={e => setOnboarding({ ...onboarding, monthly_price: e.target.value })}
                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Data de Renovação</label>
                    <input type="date" value={onboarding.renewal_date} onChange={e => setOnboarding({ ...onboarding, renewal_date: e.target.value })}
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                  </div>
                  <div className="border-t border-gray-700 pt-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Usuário Master da Empresa</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nome completo *</label>
                        <input value={onboarding.owner_name} onChange={e => setOnboarding({ ...onboarding, owner_name: e.target.value })}
                          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" placeholder="João Silva" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                        <input type="email" value={onboarding.owner_email} onChange={e => setOnboarding({ ...onboarding, owner_email: e.target.value })}
                          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" placeholder="usuariox@email.com" required />
                      </div>
                    </div>
                  </div>
                  {onboardingError && <p className="text-red-400 text-sm">{onboardingError}</p>}
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" disabled={onboardingLoading}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {onboardingLoading ? 'Criando...' : 'Criar Empresa + Usuário'}
                  </button>
                  <button type="button" onClick={resetOnboarding} className="bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-600">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Org Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingOrg(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
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
                    <option value="active">Ativo</option><option value="inactive">Inativo</option><option value="suspended">Suspenso</option>
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
              <button onClick={handleSaveOrg} disabled={saving}
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
