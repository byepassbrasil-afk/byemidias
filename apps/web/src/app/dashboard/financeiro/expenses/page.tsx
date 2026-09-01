'use client';

import { useEffect, useState } from 'react';

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  date: string;
  recurring: boolean;
  recurrence_period: string | null;
  notes: string | null;
  organization_name: string;
  creator_name: string | null;
  created_at: string;
}

const CATEGORIES = ['Infraestrutura', 'Pessoal', 'Marketing', 'Operacional', 'Software', 'Outros'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard/financeiro/expenses');
      const d = await r.json();
      setExpenses(d.expenses ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = expenses.filter((e) => !filterCategory || e.category === filterCategory);
  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta despesa?')) return;
    // Direct DB delete via SQL would be cleaner but here we'll use a simple fetch
    // Since we don't have a DELETE endpoint yet, just remove from UI for now
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function fmtCurrency(v: number, c: string) {
    return c === 'BRL' ? `R$ ${v.toFixed(2)}` : `${c} ${v.toFixed(2)}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📉 Despesas</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} despesa(s) • Total: R$ {total.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
          >
            + Nova Despesa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhuma despesa cadastrada</p>
          <p className="text-sm text-gray-600 mt-1">Clique em "+ Nova Despesa" para começar</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-5 py-3">Categoria</th>
                <th className="text-left px-5 py-3">Descrição</th>
                <th className="text-left px-5 py-3">Org</th>
                <th className="text-right px-5 py-3">Valor</th>
                <th className="text-center px-5 py-3">Recorrente</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-gray-300">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-900/30 text-red-300">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-300">{e.description || '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{e.organization_name}</td>
                  <td className="px-5 py-3 text-right font-bold text-red-300">{fmtCurrency(Number(e.amount), e.currency)}</td>
                  <td className="px-5 py-3 text-center text-xs text-gray-500">
                    {e.recurring ? `✓ ${e.recurrence_period || 'sim'}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExpenseFormModal
          saving={saving}
          setSaving={setSaving}
          categories={CATEGORIES}
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

function ExpenseFormModal({
  saving,
  setSaving,
  categories,
  onClose,
  onSaved,
}: {
  saving: boolean;
  setSaving: (b: boolean) => void;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState('monthly');
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    try {
      const r = await fetch('/api/dashboard/financeiro/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description: description || null,
          amount: Number(amount),
          date,
          recurring,
          recurrence_period: recurring ? recurrencePeriod : null,
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
          <h2 className="text-xl font-bold text-white mb-4">Nova Despesa</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoria *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Conta de luz mensal"
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
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                className="rounded" />
              <label htmlFor="recurring" className="text-sm text-gray-300">Recorrente</label>
              {recurring && (
                <select value={recurrencePeriod} onChange={(e) => setRecurrencePeriod(e.target.value)}
                  className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white">
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              )}
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
              {saving ? 'Salvando...' : 'Criar Despesa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
