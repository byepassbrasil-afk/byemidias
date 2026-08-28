'use client';

import { useEffect, useState } from 'react';

interface Invoice {
  id: string;
  partner_id: string;
  partner_name?: string;
  organization_id: string | null;
  org_name?: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  hourly_rate: number;
  monthly_rate: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genPartner, setGenPartner] = useState('');
  const [genPeriod, setGenPeriod] = useState({ start: '', end: '' });
  const [partners, setPartners] = useState<{id: string, username: string}[]>([]);

  useEffect(() => { loadInvoices(); loadPartners(); }, []);

  async function loadInvoices() {
    try {
      const res = await fetch('/api/admin/invoices');
      const data = await res.json();
      setInvoices(data.data || []);
    } catch {}
    setLoading(false);
  }

  async function loadPartners() {
    try {
      const res = await fetch('/api/admin/partners?limit=500');
      const d = await res.json();
      setPartners(d.data || []);
    } catch {}
  }

  async function handleGenerate() {
    if (!genPartner || !genPeriod.start || !genPeriod.end) return;
    setGenerating(true);
    await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: genPartner, period_start: genPeriod.start, period_end: genPeriod.end,
      }),
    });
    setGenPartner(''); setGenPeriod({ start: '', end: '' });
    setGenerating(false);
    loadInvoices();
  }

  async function handleStatus(invoiceId: string, status: string) {
    await fetch('/api/admin/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoiceId, status }),
    });
    loadInvoices();
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-800 text-gray-400',
    sent: 'bg-blue-900/50 text-blue-400',
    paid: 'bg-green-900/50 text-green-400',
    cancelled: 'bg-red-900/50 text-red-400',
  };

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faturas</h1>
          <p className="text-sm text-gray-400">{invoices.length} faturas</p>
        </div>
      </div>

      {/* Generate Invoice */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Gerar Nova Fatura</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Parceiro</label>
            <select value={genPartner} onChange={e => setGenPartner(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
              <option value="">Selecione...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Início</label>
            <input type="date" value={genPeriod.start} onChange={e => setGenPeriod({ ...genPeriod, start: e.target.value })}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Fim</label>
            <input type="date" value={genPeriod.end} onChange={e => setGenPeriod({ ...genPeriod, end: e.target.value })}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
          </div>
          <button onClick={handleGenerate} disabled={generating || !genPartner || !genPeriod.start || !genPeriod.end}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {generating ? 'Gerando...' : 'Gerar Fatura'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Período</th>
                <th className="text-right px-5 py-3">Horas</th>
                <th className="text-right px-5 py-3">Taxa/Hora</th>
                <th className="text-right px-5 py-3">Taxa Mensal</th>
                <th className="text-right px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Nenhuma fatura encontrada</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">{inv.partner_name || inv.partner_id}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(inv.period_start).toLocaleDateString('pt-BR')} — {new Date(inv.period_end).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{inv.total_hours?.toFixed(1) || '0.0'}</td>
                  <td className="px-5 py-3 text-right text-gray-300">R$ {inv.hourly_rate?.toFixed(2) || '0.00'}</td>
                  <td className="px-5 py-3 text-right text-gray-300">R$ {inv.monthly_rate?.toFixed(2) || '0.00'}</td>
                  <td className="px-5 py-3 text-right text-white font-medium">R$ {inv.total_amount?.toFixed(2) || '0.00'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[inv.status] || statusColors.draft}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {inv.status === 'draft' && (
                        <button onClick={() => handleStatus(inv.id, 'sent')} className="text-blue-400 hover:text-blue-300 text-xs">Enviar</button>
                      )}
                      {inv.status === 'sent' && (
                        <button onClick={() => handleStatus(inv.id, 'paid')} className="text-green-400 hover:text-green-300 text-xs">Pago</button>
                      )}
                      {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                        <button onClick={() => handleStatus(inv.id, 'cancelled')} className="text-red-400 hover:text-red-300 text-xs">Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
