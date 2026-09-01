'use client';

import { useEffect, useState } from 'react';

interface Revenue {
  id: string;
  source: string;
  source_id: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  currency: string;
  date: string;
  partner_id: string | null;
  partner_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  organization_name: string;
  creator_name: string | null;
  created_at: string;
}

const SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'invoice', label: 'Fatura (Invoice)' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'campaign', label: 'Campanha' },
];

export default function RevenuesPage() {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterSource, setFilterSource] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard/financeiro/revenues');
      const d = await r.json();
      setRevenues(d.revenues ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = revenues.filter((r) => !filterSource || r.source === filterSource);
  const total = filtered.reduce((sum, r) => sum + Number(r.amount), 0);

  function fmtCurrency(v: number, c: string) {
    return c === 'BRL' ? `R$ ${v.toFixed(2)}` : `${c} ${v.toFixed(2)}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📈 Receitas</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} receita(s) • Total: R$ {total.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas origens</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
          >
            + Nova Receita
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhuma receita cadastrada</p>
          <p className="text-sm text-gray-600 mt-1">As receitas de invoices pagas aparecerão automaticamente aqui</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-5 py-3">Origem</th>
                <th className="text-left px-5 py-3">Descrição</th>
                <th className="text-left px-5 py-3">Parceiro/Campanha</th>
                <th className="text-right px-5 py-3">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-gray-300">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.source === 'invoice' ? 'bg-blue-900/30 text-blue-300' :
                      r.source === 'partner' ? 'bg-purple-900/30 text-purple-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-300">{r.description || r.category || '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {r.partner_name || r.campaign_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-green-300">{fmtCurrency(Number(r.amount), r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <RevenueFormModal
          saving={saving}
          setSaving={setSaving}
          sources={SOURCES}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RevenueFormModal({
  saving,
  setSaving,
  sources,
  onClose,
  onSaved,
}: {
  saving: boolean;
  setSaving: (b: boolean) => void;
  sources: typeof RevenueFormModal.prototype extends never ? any : any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState('manual');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    try {
      const r = await fetch('/api/dashboard/financeiro/revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          category: category || null,
          description: description || null,
          amount: Number(amount),
          date,
          notes: notes || null,
        }),
      });
      if (r.ok) onSaved();
      else {
        const e = await r.json().catch(() => ({}));
        alert('Erro: ' + (e.error || 'desconhecido'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Nova Receita</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Origem *</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                {sources.map((s: any) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoria</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Publicidade mensal"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !amount}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Criar Receita'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
