'use client';

import { useEffect, useState, useCallback } from 'react';

type PartnerRate = {
  partner_id: string;
  partner_name: string;
  partner_username: string;
  org_name: string;
  hourly_rate: number;
  monthly_rate: number;
  currency: string;
  updated: boolean;
};

export default function PartnerPaymentsPage() {
  const [partners, setPartners] = useState<PartnerRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch partners list
      const [partnersRes, paymentsRes] = await Promise.all([
        fetch('/api/admin/partners'),
        fetch('/api/admin/partner-payments'),
      ]);
      const partnersJson = await partnersRes.json();
      const paymentsJson = await paymentsRes.json();

      const ratesMap: Record<string, { hourly_rate: number; monthly_rate: number; currency: string }> = {};
      for (const p of (paymentsJson.payments ?? [])) {
        ratesMap[p.partner_id] = {
          hourly_rate: Number(p.hourly_rate || 0),
          monthly_rate: Number(p.monthly_rate || 0),
          currency: p.currency || 'BRL',
        };
      }

      const partnersList: PartnerRate[] = ((partnersJson.partners ?? []) as Array<Record<string, unknown>>).map((p: Record<string, unknown>) => {
        const rates = ratesMap[p.id as string] || { hourly_rate: 0.5, monthly_rate: 0, currency: 'BRL' };
        return {
          partner_id: p.id as string,
          partner_name: (p.display_name as string) ?? (p.username as string) ?? 'Sem nome',
          partner_username: p.username as string,
          org_name: partnersJson.org_slug || '',
          hourly_rate: rates.hourly_rate,
          monthly_rate: rates.monthly_rate,
          currency: rates.currency,
          updated: false,
        };
      });
      setPartners(partnersList);
    } catch (e) {
      console.error('Failed to fetch partners', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  function updateRate(partnerId: string, field: 'hourly_rate' | 'monthly_rate', value: string) {
    setPartners(prev => prev.map(p => {
      if (p.partner_id !== partnerId) return p;
      const num = parseFloat(value) || 0;
      return { ...p, [field]: num, updated: true };
    }));
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    try {
      for (const p of partners.filter(p => p.updated)) {
        const res = await fetch('/api/admin/partner-payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner_id: p.partner_id,
            hourly_rate: p.hourly_rate,
            monthly_rate: p.monthly_rate,
            currency: p.currency,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao salvar');
        }
      }
      setMessage({ type: 'success', text: 'Tarifas salvas com sucesso!' });
      setPartners(prev => prev.map(p => ({ ...p, updated: false })));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setMessage({ type: 'error', text: msg });
    }
    setSaving(false);
  }

  function getPaymentType(p: PartnerRate) {
    if (p.monthly_rate > 0) return 'Mensal';
    if (p.hourly_rate > 0) return 'Por Hora';
    return 'Não configurado';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tarifas de Parceiros</h1>
        <button
          onClick={saveAll}
          disabled={saving || !partners.some(p => p.updated)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : '💾 Salvar Alterações'}
        </button>
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
      ) : partners.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-12 text-center text-gray-500">
          Nenhum parceiro cadastrado ainda.
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 bg-gray-950">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Usuário</th>
                <th className="text-left px-5 py-3">Tipo Atual</th>
                <th className="text-right px-5 py-3">Valor/Hora (R$)</th>
                <th className="text-right px-5 py-3">Valor Mensal (R$)</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.partner_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white font-medium">{p.partner_name}</td>
                  <td className="px-5 py-3 text-gray-400">@{p.partner_username}</td>
                  <td className="px-5 py-3 text-gray-300">{getPaymentType(p)}</td>
                  <td className="px-5 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.hourly_rate || ''}
                      onChange={(e) => updateRate(p.partner_id, 'hourly_rate', e.target.value)}
                      className="w-28 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-right text-white text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.monthly_rate || ''}
                      onChange={(e) => updateRate(p.partner_id, 'monthly_rate', e.target.value)}
                      className="w-28 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-right text-white text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-5 py-3">
                    {p.updated ? (
                      <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-400">Alterado</span>
                    ) : (
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 space-y-2 text-sm text-gray-400">
        <h3 className="font-semibold text-white">Como funciona o faturamento</h3>
        <p>• <strong>Valor/Hora:</strong> cada partner é cobrado pelo tempo que seus devices ficam online (uptime). Ex: 0,50 × 100h = R$ 50,00</p>
        <p>• <strong>Valor Mensal:</strong> cobra um valor fixo independente do uptime (sobrescreve o valor/hora)</p>
        <p>• Campos em branco = usa R$ 0,50/hora como padrão</p>
        <p>• Dados de uptime vêm das sessões dos devices de cada partner no período selecionado</p>
      </div>
    </div>
  );
}
