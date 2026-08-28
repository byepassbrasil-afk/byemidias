'use client';

import { useEffect, useState, useCallback } from 'react';

type Invoice = {
  id: string;
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid';
  created_at: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return first.toISOString().split('T')[0];
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/invoices');
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.invoices ?? []);
      }
    } catch (e) {
      console.error('Failed to fetch invoices', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function generateInvoice(partnerId: string, partnerName: string) {
    if (!confirm(`Gerar fatura para ${partnerName} referente a ${period}?`)) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: partnerId, period_start: `${period}-01` }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Fatura gerada: R$ ${json.invoice?.total_amount?.toFixed(2)}` });
        fetchInvoices();
      } else {
        setMessage({ type: 'error', text: json.error || 'Erro ao gerar' });
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: 'Erro de conexão' });
    }
    setGenerating(false);
  }

  async function updateStatus(invoiceId: string, status: string) {
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, status }),
      });
      if (res.ok) fetchInvoices();
    } catch (e) {
      console.error('Failed to update status', e);
    }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const formatMoney = (n: number) => `R$ ${(n ?? 0).toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Faturas</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Período:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          message.type === 'success' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-12 text-center text-gray-500">
          Nenhuma fatura gerada ainda.
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 bg-gray-950">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Período</th>
                <th className="text-right px-5 py-3">Horas</th>
                <th className="text-right px-5 py-3">Valor Total</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Criada em</th>
                <th className="text-left px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white font-medium">{inv.partner_name}</td>
                  <td className="px-5 py-3 text-gray-300">{formatDate(inv.period_start)} — {formatDate(inv.period_end)}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{inv.total_hours.toFixed(1)}h</td>
                  <td className="px-5 py-3 text-right text-yellow-400 font-semibold">{formatMoney(inv.total_amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      inv.status === 'paid' ? 'bg-green-900/50 text-green-400' :
                      inv.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {inv.status === 'paid' ? 'Pago' : inv.status === 'sent' ? 'Enviada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(inv.created_at)}</td>
                  <td className="px-5 py-3">
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => updateStatus(inv.id, 'sent')}
                        className="text-xs text-blue-400 hover:text-blue-300 mr-3"
                      >
                        Marcar como Enviada
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button
                        onClick={() => updateStatus(inv.id, 'paid')}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Marcar como Paga
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
