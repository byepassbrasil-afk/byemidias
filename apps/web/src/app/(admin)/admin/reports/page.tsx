'use client';

import { useEffect, useState } from 'react';

interface Report {
  id: string;
  name: string;
  type: string;
  status: string;
  partner_id: string | null;
  organization_id: string | null;
  period_start: string | null;
  period_end: string | null;
  file_url: string | null;
  created_at: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    try {
      const res = await fetch('/api/admin/crud/reports?limit=200');
      const data = await res.json();
      setReports(data.data || []);
    } catch {}
    setLoading(false);
  }

  const typeLabels: Record<string, string> = {
    basic: 'Básico', campaign: 'Campanha', activity: 'Atividade', financial: 'Financeiro',
    partner: 'Parceiro', device: 'Dispositivo', invoice: 'Fatura',
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-900/50 text-green-400',
    failed: 'bg-red-900/50 text-red-400',
    pending: 'bg-yellow-900/50 text-yellow-400',
  };

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-sm text-gray-400">{reports.length} relatórios</p>
        </div>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Período</th>
                <th className="text-left px-5 py-3">Criado em</th>
                <th className="text-left px-5 py-3">Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">Nenhum relatório encontrado</td></tr>
              ) : reports.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">{r.name}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{typeLabels[r.type] || r.type}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[r.status] || 'bg-gray-800 text-gray-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {r.period_start && r.period_end
                      ? `${new Date(r.period_start).toLocaleDateString('pt-BR')} — ${new Date(r.period_end).toLocaleDateString('pt-BR')}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-3">
                    {r.file_url ? (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">
                        Download
                      </a>
                    ) : <span className="text-gray-500 text-xs">—</span>}
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
