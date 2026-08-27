'use client';

import { useEffect, useState, useCallback } from 'react';

type ReportType = 'basic' | 'campaign' | 'activity' | 'financial';

const REPORT_TABS: { key: ReportType; label: string; icon: string }[] = [
  { key: 'basic', label: 'Básicos', icon: '📊' },
  { key: 'campaign', label: 'Campanhas', icon: '📢' },
  { key: 'activity', label: 'Atividade', icon: '📈' },
  { key: 'financial', label: 'Financeiro', icon: '💰' },
];

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('basic');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?type=${activeTab}&days=${days}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to fetch report', e);
    }
    setLoading(false);
  }, [activeTab, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatHours = (h: number | null | undefined) => {
    const n = h ?? 0;
    if (!Number.isFinite(n) || n <= 0) return '0min';
    if (n < 1) return `${Math.round(n * 60)}min`;
    const hours = Math.floor(n);
    const mins = Math.round((n - hours) * 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Export CSV
  function exportCSV() {
    if (!data) return;
    let csv = '';
    const filename = `relatorio-${activeTab}-${days}d.csv`;

    if (activeTab === 'basic') {
      const devices = (data.devices as Array<Record<string, unknown>>) ?? [];
      csv = 'Status,Nome,Modelo,Versão,Uptime,Reproduções\n';
      devices.forEach(d => {
        csv += `${d.is_online ? 'Online' : 'Offline'},"${d.name ?? ''}","${d.model ?? ''}","${d.player_version ?? ''}","${d.uptime_hours ?? 0}h",${d.play_count ?? 0}\n`;
      });
    } else if (activeTab === 'campaign') {
      const campaigns = (data.campaigns as Array<Record<string, unknown>>) ?? [];
      csv = 'Campanha,Reproduções\n';
      campaigns.forEach(c => { csv += `"${c.name ?? ''}",${c.plays ?? 0}\n`; });
    } else if (activeTab === 'financial') {
      const partners = (data.partners as Array<Record<string, unknown>>) ?? [];
      csv = 'Parceiro,Tipo,Dispositivos,Horas,Valor/Hora,Valor Mensal,Total\n';
      partners.forEach(p => {
        csv += `"${p.partner_id ?? ''}",${p.payment_type ?? ''},${p.devices_count ?? 1},"${p.hours ?? 0}h",${p.hourly_rate ?? 0},${p.monthly_rate ?? 0},${p.estimated_amount ?? 0}\n`;
      });
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // Export PDF (browser print)
  function exportPDF() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-print, .report-print * { visibility: visible; }
          .report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button onClick={exportCSV} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600 transition-colors" title="Exportar CSV">
            📄 CSV
          </button>
          <button onClick={exportPDF} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600 transition-colors" title="Exportar PDF">
            📑 PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900 p-1 no-print">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      )}

      <div className="report-print">
        {!loading && data && activeTab === 'basic' && (
          <BasicReport data={data} formatHours={formatHours} />
        )}

        {!loading && data && activeTab === 'campaign' && (
          <CampaignReport data={data} />
        )}

        {!loading && data && activeTab === 'activity' && (
          <ActivityReport data={data} />
        )}

        {!loading && data && activeTab === 'financial' && (
          <FinancialReport data={data} formatHours={formatHours} />
        )}
      </div>
    </div>
  );
}

function BasicReport({ data, formatHours }: { data: Record<string, unknown>; formatHours: (h: number | null | undefined) => string }) {
  const summary = (data.summary as Record<string, number | undefined> | undefined) ?? {};
  const devices = (data.devices as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Dispositivos', value: summary.total_devices, icon: '📺' },
          { label: 'Online', value: summary.online_devices, icon: '🟢' },
          { label: 'Offline', value: summary.offline_devices, icon: '🔴' },
          { label: 'Mídias', value: summary.total_media, icon: '📁' },
          { label: 'Campanhas', value: summary.active_campaigns, icon: '📢' },
          { label: 'Reproduções', value: summary.total_plays, icon: '▶️' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-gray-900 print:bg-gray-100 border border-gray-800 print:border-gray-300 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs text-gray-400 print:text-gray-600">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-white print:text-gray-900">{card.value ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Dispositivos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Modelo</th>
                <th className="text-left px-5 py-3">Versão</th>
                <th className="text-right px-5 py-3">Uptime</th>
                <th className="text-right px-5 py-3">Reproduções</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                    Nenhum dispositivo encontrado
                  </td>
                </tr>
              ) : devices.map((d) => {
                const isOnline = Boolean(d.is_online);
                return (
                  <tr key={(d.id as string) ?? Math.random()} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isOnline ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white">{(d.name as string) ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-300">{(d.model as string) ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400">{(d.player_version as string) ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-green-400 font-medium">
                      {formatHours(d.uptime_hours as number)}
                    </td>
                    <td className="px-5 py-3 text-right text-white">{(d.play_count as number) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CampaignReport({ data }: { data: Record<string, unknown> }) {
  const campaigns = (data.campaigns as Array<Record<string, unknown>> | undefined) ?? [];
  const totalPlays = (data.total_plays as number) ?? 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Total de reproduções: <span className="text-white font-semibold">{totalPlays}</span>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-12 text-center text-gray-500">
          Nenhum dado de campanha encontrado no período
        </div>
      ) : campaigns.map((c) => {
        const topMedia = (c.top_media as Array<Record<string, unknown>> | undefined) ?? [];
        return (
          <div key={(c.id as string) ?? Math.random()} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-lg">{(c.name as string) ?? 'Sem nome'}</h3>
              <span className="text-blue-400 font-semibold">{(c.plays as number) ?? 0} reproduções</span>
            </div>

            {topMedia.length > 0 && (
              <>
                <div className="text-xs text-gray-500 mb-2">Top mídias:</div>
                <div className="space-y-1">
                  {topMedia.map((m, i) => (
                    <div key={(m.id as string) ?? i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{(m.name as string) ?? '—'}</span>
                      <span className="text-gray-500">{((m.count as number) ?? 0)}x</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityReport({ data }: { data: Record<string, unknown> }) {
  const heatmapRaw = (data.heatmap as number[][] | undefined) ?? [];
  const hourlyTotal = (data.hourly_total as number[] | undefined) ?? [];
  const dailyTotal = (data.daily_total as number[] | undefined) ?? [];
  const deviceActivity = (data.device_activity as Array<Record<string, unknown>> | undefined) ?? [];

  // Garante shape 7x24 mesmo se o back mandou vazio
  const heatmap: number[][] = Array.from({ length: 7 }, (_, dayIdx) =>
    Array.from({ length: 24 }, (_, hourIdx) => heatmapRaw[dayIdx]?.[hourIdx] ?? 0)
  );
  const hourly: number[] = Array.from({ length: 24 }, (_, i) => hourlyTotal[i] ?? 0);
  const daily: number[] = Array.from({ length: 7 }, (_, i) => dailyTotal[i] ?? 0);

  const maxVal = Math.max(...heatmap.flat(), 1);
  const maxHourly = Math.max(...hourly, 1);
  const maxPlays = Math.max(...deviceActivity.map(x => (x.plays as number) ?? 0), 1);
  const totalEvents = (data.total_events as number) ?? hourly.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Total events header */}
      <div className="text-sm text-gray-400">
        Total de eventos no período: <span className="text-white font-semibold">{totalEvents}</span>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-4">Mapa de Atividade (Hora x Dia)</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header - hours */}
            <div className="flex gap-1 mb-1">
              <div className="w-12" />
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="flex-1 text-center text-[10px] text-gray-500">
                  {i.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
            {/* Rows */}
            {DAYS_OF_WEEK.map((day, dayIdx) => (
              <div key={dayIdx} className="flex gap-1 mb-1">
                <div className="w-12 text-xs text-gray-400 flex items-center">{day}</div>
                {heatmap[dayIdx].map((val, hourIdx) => {
                  const intensity = val / maxVal;
                  return (
                    <div
                      key={hourIdx}
                      className="flex-1 aspect-square rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30"
                      style={{
                        backgroundColor: val === 0
                          ? 'rgb(31, 41, 55)'
                          : `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`,
                      }}
                      title={`${day} ${hourIdx}:00 - ${val} reproduções`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly totals bar chart */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-4">Atividade por Hora</h2>
        <div className="flex items-end gap-1 h-32">
          {hourly.map((val, i) => {
            const height = (val / maxHourly) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max(height, val > 0 ? 2 : 0)}%` }}
                  title={`${i}:00 - ${val}`}
                />
                <span className="text-[9px] text-gray-500">{i}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily totals */}
      {daily.some(v => v > 0) && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <h2 className="font-semibold text-white mb-4">Atividade por Dia da Semana</h2>
          <div className="flex items-end gap-2 h-24">
            {DAYS_OF_WEEK.map((day, i) => {
              const height = (daily[i] / Math.max(...daily, 1)) * 100;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-purple-500 rounded-t" style={{ height: `${Math.max(height, daily[i] > 0 ? 2 : 0)}%` }} title={`${day} - ${daily[i]}`} />
                  <span className="text-[10px] text-gray-400">{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Device activity */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-4">Atividade por Dispositivo</h2>
        {deviceActivity.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Nenhuma atividade registrada no período</div>
        ) : (
          <div className="space-y-2">
            {deviceActivity.map((d, i) => {
              const plays = (d.plays as number) ?? 0;
              const width = (plays / maxPlays) * 100;
              return (
                <div key={(d.id as string) ?? i} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-gray-300 truncate">{(d.name as string) ?? 'Sem nome'}</div>
                  <div className="flex-1 bg-gray-800 rounded-full h-4">
                    <div className="bg-blue-500 rounded-full h-4 flex items-center justify-end pr-2" style={{ width: `${Math.max(width, plays > 0 ? 5 : 0)}%` }}>
                      <span className="text-[10px] text-white font-medium">{plays}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FinancialReport({ data, formatHours }: { data: Record<string, unknown>; formatHours: (h: number) => string }) {
  // Back pode mandar `partners` (novo) ou `devices` (legado). Aceita os dois.
  const partners = (data.partners as Array<Record<string, unknown>> | undefined)
    ?? (data.devices as Array<Record<string, unknown>> | undefined)
    ?? [];
  const totalAmount = (data.total_amount as number) ?? 0;
  const totalHours = (data.total_hours as number) ?? 0;

  const formatMoney = (n: number | undefined | null) => `R$ ${(n ?? 0).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Total de Horas</div>
          <div className="text-3xl font-bold text-white">{formatHours(totalHours)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Total Estimado</div>
          <div className="text-3xl font-bold text-yellow-400">{formatMoney(totalAmount)}</div>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Parceiros Ativos</div>
          <div className="text-3xl font-bold text-white">{partners.length}</div>
        </div>
      </div>

      {/* Partner table */}
      <div className="rounded-xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Pagamento por Parceiro</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-right px-5 py-3">Dispositivos</th>
                <th className="text-right px-5 py-3">Horas</th>
                <th className="text-right px-5 py-3">Valor/Hora</th>
                <th className="text-right px-5 py-3">Valor Mensal</th>
                <th className="text-right px-5 py-3">Total Estimado</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    Nenhum parceiro com cobrança no período
                  </td>
                </tr>
              ) : partners.map((p, i) => {
                const paymentType = (p.payment_type as string) ?? 'hourly';
                const hours = (p.hours as number) ?? 0;
                return (
                  <tr key={(p.partner_id as string) ?? (p.device_id as string) ?? i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-white font-medium">{(p.partner_id as string) ?? (p.device_id as string) ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        paymentType === 'hourly' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'
                      }`}>
                        {paymentType === 'hourly' ? 'Por Hora' : 'Mensal'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">{(p.devices_count as number) ?? 1}</td>
                    <td className="px-5 py-3 text-right text-white">{formatHours(hours)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {paymentType === 'hourly' ? formatMoney(p.hourly_rate as number) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {paymentType === 'monthly' ? formatMoney(p.monthly_rate as number) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right text-yellow-400 font-semibold">
                      {formatMoney(p.estimated_amount as number)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
