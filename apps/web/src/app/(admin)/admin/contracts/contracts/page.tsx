'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Contract {
  id: string;
  partner_id: string;
  partner_username: string;
  partner_name: string;
  organization_id: string;
  organization_name: string;
  template_id: string | null;
  template_name: string | null;
  start_date: string;
  end_date: string | null;
  duration_months: number;
  monthly_fee: number;
  hourly_fee: number;
  status: string;
  contract_pdf_url: string | null;
  contract_url_token: string | null;
  signed_at: string | null;
  created_at: string;
}

export default function PartnerContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [partners, setPartners] = useState<Array<{ id: string; display_name: string; username: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; duration_months: number | null; monthly_fee: number; hourly_fee: number; bonus_structure: any; custom_clauses: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterExpiring) params.set('expiring_soon', 'true');
      const r = await fetch(`/api/admin/partner-contracts?${params}`);
      const d = await r.json();
      setContracts(d.contracts ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterExpiring]);

  const filteredContracts = contracts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.partner_name?.toLowerCase().includes(q) ||
      c.partner_username?.toLowerCase().includes(q) ||
      c.organization_name?.toLowerCase().includes(q) ||
      c.template_name?.toLowerCase().includes(q)
    );
  });

  const loadRefs = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch('/api/admin/partners').then((r) => r.json()),
        fetch('/api/admin/contract-templates').then((r) => r.json()),
      ]);
      setPartners(pRes.partners ?? []);
      setTemplates((tRes.templates ?? []).filter((t: any) => t.status === 'active'));
    } catch {}
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);
  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: string) {
    if (!confirm('Cancelar este contrato?')) return;
    await fetch(`/api/admin/partner-contracts/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/contracts" className="text-sm text-gray-400 hover:text-white">← Contratos</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Contratos dos Parceiros</h1>
          <p className="text-sm text-gray-500 mt-1">
            {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
            {filterExpiring && ' • Expirando nos próximos 30 dias'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
        >
          + Novo Contrato
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por parceiro, organização ou modelo…"
            className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setFilterStatus(''); setFilterExpiring(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs ${filterStatus === '' && !filterExpiring ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Todos
          </button>
          <button onClick={() => { setFilterStatus('active'); setFilterExpiring(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs ${filterStatus === 'active' && !filterExpiring ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Ativos
          </button>
          <button onClick={() => { setFilterStatus('expired'); setFilterExpiring(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs ${filterStatus === 'expired' && !filterExpiring ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Expirados
          </button>
          <button onClick={() => { setFilterExpiring(!filterExpiring); setFilterStatus(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs ${filterExpiring ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            ⚠ Expirando (30d)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          Carregando...
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-16 text-center">
          <p className="text-gray-400 font-medium">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Vigência</th>
                <th className="text-left px-5 py-3">Valor</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredContracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{c.partner_name}</p>
                    <p className="text-xs text-gray-500">@{c.partner_username}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-300 text-xs">
                    <p>{new Date(c.start_date).toLocaleDateString('pt-BR')} → {c.end_date ? new Date(c.end_date).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>
                    <p className="text-gray-500">{c.duration_months} {c.duration_months === 1 ? 'mês' : 'meses'}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-300">R$ {Number(c.monthly_fee).toFixed(2)}/mês</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'active' ? 'bg-green-900/40 text-green-300' :
                      c.status === 'expired' ? 'bg-yellow-900/40 text-yellow-300' :
                      c.status === 'cancelled' ? 'bg-red-900/40 text-red-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {c.status === 'active' ? 'Ativo' :
                       c.status === 'expired' ? 'Expirado' :
                       c.status === 'cancelled' ? 'Cancelado' :
                       c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => router.push(`/admin/contracts/contracts/${c.id}`)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      Ver
                    </button>
                    {c.status === 'active' && (
                      <button
                        onClick={() => handleCancel(c.id)}
                        className="ml-2 rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ContractFormModal
          partners={partners}
          templates={templates}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ContractFormModal({
  partners,
  templates,
  onClose,
  onSaved,
}: {
  partners: Array<{ id: string; display_name: string; username: string }>;
  templates: Array<any>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [partnerId, setPartnerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState(12);
  const [monthlyFee, setMonthlyFee] = useState('0');
  const [hourlyFee, setHourlyFee] = useState('0');
  const [bonusStructure, setBonusStructure] = useState<any>(null);
  const [customClauses, setCustomClauses] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setDurationMonths(tpl.duration_months || 12);
    setMonthlyFee(String(tpl.monthly_fee));
    setHourlyFee(String(tpl.hourly_fee));
    setBonusStructure(tpl.bonus_structure);
    setCustomClauses(tpl.custom_clauses || '');
  }

  function endDateStr(): string {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + durationMonths);
    return d.toISOString().split('T')[0];
  }

  async function handleSave() {
    if (!partnerId || !startDate || durationMonths < 1) return;
    setSaving(true);
    await fetch('/api/admin/partner-contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: partnerId,
        template_id: templateId || null,
        start_date: startDate,
        duration_months: durationMonths,
        monthly_fee: Number(monthlyFee),
        hourly_fee: Number(hourlyFee),
        bonus_structure: bonusStructure,
        custom_clauses: customClauses || null,
        notes: notes || null,
        status: 'active',
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-1">Novo Contrato</h2>
          <p className="text-sm text-gray-400 mb-4">
            Será gerado um PDF automaticamente + link público para compartilhar
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Parceiro *</label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                <option value="">Selecione...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name || p.username} (@{p.username})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Modelo (opcional)</label>
              <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                <option value="">Contrato customizado</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Selecionar modelo preenche os valores abaixo (editáveis)</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Data de início *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Duração (meses) *</label>
                <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-sm">
              <span className="text-blue-300">Vigência:</span>{' '}
              <strong className="text-white">{new Date(startDate).toLocaleDateString('pt-BR')} → {new Date(endDateStr()).toLocaleDateString('pt-BR')}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Mensalidade R$</label>
                <input type="number" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Por hora R$</label>
                <input type="number" step="0.01" value={hourlyFee} onChange={(e) => setHourlyFee(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            {bonusStructure && (
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 text-sm">
                <p className="text-green-300 mb-1">Bonificação (do modelo):</p>
                <pre className="text-xs text-green-200 whitespace-pre-wrap">{JSON.stringify(bonusStructure, null, 2)}</pre>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-300 mb-1">Cláusulas extras</label>
              <textarea value={customClauses} onChange={(e) => setCustomClauses(e.target.value)} rows={3}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Notas internas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !partnerId || durationMonths < 1}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Gerando PDF...' : 'Criar Contrato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
