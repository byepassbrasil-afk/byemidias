'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ContractTemplate {
  id: string;
  name: string;
  duration_months: number | null;
  monthly_fee: number;
  hourly_fee: number;
  bonus_structure: any;
  custom_clauses: string | null;
  status: string;
  organization_name: string;
  organization_id: string;
  creator_name: string | null;
  created_at: string;
}

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/contract-templates');
      const d = await r.json();
      setTemplates(d.templates ?? []);
      // Get user org from profile
      const p = await fetch('/api/auth/profile').then((r) => r.json());
      setOrgId(p?.profile?.organization_id || '');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Arquivar este modelo?')) return;
    await fetch(`/api/admin/contract-templates/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleRestore(id: string) {
    await fetch(`/api/admin/contract-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/contracts" className="text-sm text-gray-400 hover:text-white">← Contratos</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Modelos de Contrato</h1>
          <p className="text-sm text-gray-500 mt-1">{templates.length} modelo{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
        >
          + Novo Modelo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          Carregando...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhum modelo cadastrado</p>
          <p className="text-sm text-gray-600 mt-1">Crie o primeiro modelo clicando em "+ Novo Modelo"</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Duração</th>
                <th className="text-left px-5 py-3">Mensal</th>
                <th className="text-left px-5 py-3">Por hora</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">criado por {t.creator_name || '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-300">
                    {t.duration_months ? `${t.duration_months} ${t.duration_months === 1 ? 'mês' : 'meses'}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-300">R$ {Number(t.monthly_fee).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-300">R$ {Number(t.hourly_fee).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${t.status === 'active' ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {t.status === 'active' ? 'Ativo' : 'Arquivado'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditing(t); setShowForm(true); }}
                        className="rounded-lg bg-blue-900/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-900/50"
                      >
                        Editar
                      </button>
                      {t.status === 'active' ? (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50"
                        >
                          Arquivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(t.id)}
                          className="rounded-lg bg-green-900/30 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-900/50"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <TemplateFormModal
          editing={editing}
          organizationId={orgId}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function TemplateFormModal({
  editing,
  organizationId,
  saving,
  setSaving,
  onClose,
  onSaved,
}: {
  editing: ContractTemplate | null;
  organizationId: string;
  saving: boolean;
  setSaving: (b: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [duration, setDuration] = useState<string>(editing?.duration_months?.toString() || '12');
  const [durationCustom, setDurationCustom] = useState('');
  const [monthlyFee, setMonthlyFee] = useState(editing?.monthly_fee?.toString() || '0');
  const [hourlyFee, setHourlyFee] = useState(editing?.hourly_fee?.toString() || '0');
  const [bonusType, setBonusType] = useState<'tier' | 'fixed' | 'none'>('none');
  const [bonusTiersJson, setBonusTiersJson] = useState('[]');
  const [fixedHours, setFixedHours] = useState('150');
  const [fixedAmount, setFixedAmount] = useState('300');
  const [customClauses, setCustomClauses] = useState(editing?.custom_clauses || '');

  async function handleSave() {
    if (!name) return;
    setSaving(true);
    let bonus_structure: any = null;
    if (bonusType === 'tier') {
      try {
        const tiers = JSON.parse(bonusTiersJson);
        if (tiers.length > 0) bonus_structure = { type: 'tier', tiers, currency: 'BRL' };
      } catch {}
    } else if (bonusType === 'fixed') {
      bonus_structure = {
        type: 'fixed',
        monthly_target_hours: Number(fixedHours),
        monthly_bonus_amount: Number(fixedAmount),
        currency: 'BRL',
      };
    }

    const duration_months = duration === 'custom' ? Number(durationCustom) : Number(duration);
    const payload: any = {
      organization_id: editing?.organization_id || organizationId,
      name,
      duration_months,
      monthly_fee: Number(monthlyFee),
      hourly_fee: Number(hourlyFee),
      bonus_structure,
      custom_clauses: customClauses || null,
    };

    const url = editing ? `/api/admin/contract-templates/${editing.id}` : '/api/admin/contract-templates';
    const method = editing ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-1">{editing ? 'Editar' : 'Novo'} Modelo</h2>
          <p className="text-sm text-gray-400 mb-4">Defina valores padrão para contratos com este modelo</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Nome do modelo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder='Ex: "Padrão 12 meses"'
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Duração (meses)</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {[3, 6, 12, 24, 36].map((d) => (
                    <option key={d} value={d}>{d} meses</option>
                  ))}
                  <option value="custom">Customizado</option>
                </select>
                {duration === 'custom' && (
                  <input type="number" value={durationCustom} onChange={(e) => setDurationCustom(e.target.value)}
                    placeholder="Meses"
                    className="mt-2 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 col-span-2 md:col-span-1">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Mensal R$</label>
                  <input type="number" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Por hora R$</label>
                  <input type="number" step="0.01" value={hourlyFee} onChange={(e) => setHourlyFee(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Bonificação</label>
              <select value={bonusType} onChange={(e) => setBonusType(e.target.value as any)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                <option value="none">Sem bonificação</option>
                <option value="tier">Por tier (faixas de horas)</option>
                <option value="fixed">Valor fixo por meta mensal</option>
              </select>
              {bonusType === 'tier' && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">JSON: array de tiers. Ex: <code>[{"{"}"min_hours":100,"bonus_amount":500{"}"}]</code></p>
                  <textarea value={bonusTiersJson} onChange={(e) => setBonusTiersJson(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-white font-mono" />
                </div>
              )}
              {bonusType === 'fixed' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="number" value={fixedHours} onChange={(e) => setFixedHours(e.target.value)}
                    placeholder="Horas/mês"
                    className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                  <input type="number" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)}
                    placeholder="Bônus R$"
                    className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Cláusulas customizadas (opcional)</label>
              <textarea value={customClauses} onChange={(e) => setCustomClauses(e.target.value)}
                rows={4}
                placeholder="Texto livre de cláusulas extras…"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !name}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Salvando...' : (editing ? 'Atualizar' : 'Criar Modelo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
