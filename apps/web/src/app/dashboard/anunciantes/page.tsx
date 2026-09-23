'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Advertiser = {
  id: string;
  name: string;
  establishment_name: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  ticket_value: number;
  status: string;
  device_count: number;
  media_count: number;
  open_invoices: number;
  next_due: string | null;
  created_at: string;
};

export default function AnunciantesPage() {
  const router = useRouter();
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', establishment_name: '', email: '', phone: '', document: '', address: '', ticket_value: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/dashboard/advertisers?${params}`);
      const json = await res.json();
      setAdvertisers(json.advertisers || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/advertisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ticket_value: parseFloat(form.ticket_value) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Erro ao criar'); return; }
      setShowForm(false);
      setForm({ name: '', establishment_name: '', email: '', phone: '', document: '', address: '', ticket_value: '' });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const BRAND = '#ee6a1e';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anunciantes</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie seus clientes anunciantes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-white font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: BRAND }}
        >
          + Novo Anunciante
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nome ou estabelecimento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white placeholder-gray-500 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
        >
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {/* Summary Card */}
      {!loading && advertisers.length > 0 && (() => {
        const totalTickets = advertisers.reduce((sum, a) => sum + Number(a.ticket_value || 0), 0);
        const totalFaturamento = advertisers.reduce((sum, a) => sum + (Number(a.ticket_value || 0) * Number(a.open_invoices || 0)), 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <p className="text-xs text-gray-500 mb-1">Total de Anunciantes</p>
              <p className="text-2xl font-bold text-white">{advertisers.length}</p>
            </div>
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <p className="text-xs text-gray-500 mb-1">Ticket Médio</p>
              <p className="text-2xl font-bold" style={{ color: BRAND }}>
                {formatCurrency(totalTickets / advertisers.length)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <p className="text-xs text-gray-500 mb-1">Faturamento Potencial (tickets × faturas)</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(totalFaturamento)}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Carregando...</div>
      ) : advertisers.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-gray-900 border border-gray-800">
          <p className="text-gray-500">Nenhum anunciante encontrado.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm" style={{ color: BRAND }}>
            + Criar primeiro anunciante
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {([...advertisers].sort((a, b) => {
            // Overdue first
            const aOverdue = a.next_due && new Date(a.next_due) < new Date() && a.open_invoices > 0;
            const bOverdue = b.next_due && new Date(b.next_due) < new Date() && b.open_invoices > 0;
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            // Then by next_due ascending
            if (a.next_due && b.next_due) return new Date(a.next_due).getTime() - new Date(b.next_due).getTime();
            if (a.next_due) return -1;
            if (b.next_due) return 1;
            return 0;
          })).map((adv) => {
            const isOverdue = adv.next_due && new Date(adv.next_due) < new Date() && adv.open_invoices > 0;
            return (
              <div
                key={adv.id}
                className={`rounded-xl bg-gray-900 border p-5 cursor-pointer hover:border-gray-700 transition-colors ${isOverdue ? 'border-red-900/50' : 'border-gray-800'}`}
                onClick={() => router.push(`/dashboard/anunciantes/${adv.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{adv.name}</h3>
                      {isOverdue && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-red-900/60 text-red-300 border border-red-700">
                          VENCIDO
                        </span>
                      )}
                    </div>
                    {adv.establishment_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{adv.establishment_name}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    adv.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {adv.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Ticket */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500">Ticket</p>
                  <p className="text-lg font-bold" style={{ color: BRAND }}>
                    {formatCurrency(Number(adv.ticket_value || 0))}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center rounded-lg bg-gray-800/50 p-2">
                    <p className="text-xs text-gray-500">Terminais</p>
                    <p className="text-sm font-semibold text-white">{adv.device_count}</p>
                  </div>
                  <div className="text-center rounded-lg bg-gray-800/50 p-2">
                    <p className="text-xs text-gray-500">Mídias</p>
                    <p className="text-sm font-semibold text-white">{adv.media_count}</p>
                  </div>
                  <div className="text-center rounded-lg bg-gray-800/50 p-2">
                    <p className="text-xs text-gray-500">Faturas</p>
                    <p className={`text-sm font-semibold ${adv.open_invoices > 0 ? 'text-orange-400' : 'text-gray-400'}`}>{adv.open_invoices}</p>
                  </div>
                </div>

                {/* Next due */}
                {adv.next_due && (
                  <div className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                    {isOverdue ? 'Venceu: ' : 'Próximo vencimento: '}
                    <span className={isOverdue ? 'text-red-300 font-semibold' : 'text-white'}>
                      {formatDate(adv.next_due)}
                    </span>
                  </div>
                )}
                {!adv.next_due && adv.open_invoices === 0 && (
                  <div className="text-xs text-gray-500">Nenhuma fatura aberta</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-gray-900 border border-gray-700 w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Novo Anunciante</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estabelecimento</label>
                  <input value={form.establishment_name} onChange={e => setForm(f => ({ ...f, establishment_name: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Telefone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">CNPJ/CPF</label>
                  <input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ticket (R$)</label>
                  <input type="number" step="0.01" value={form.ticket_value} onChange={e => setForm(f => ({ ...f, ticket_value: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Endereço</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="rounded-lg px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: BRAND }}>
                  {saving ? 'Salvando...' : 'Criar Anunciante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
