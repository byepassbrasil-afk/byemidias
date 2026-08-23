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

  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}min`;
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatórios</h1>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
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
  );
}

function BasicReport({ data, formatHours }: { data: Record<string, unknown>; formatHours: (h: number) => string }) {
  const summary = data.summary as Record<string, number>;
  const devices = data.devices as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Dispositivos', value: summary.total_devices, icon: '📺', color: 'blue' },
          { label: 'Online', value: summary.online_devices, icon: '🟢', color: 'green' },
          { label: 'Offline', value: summary.offline_devices, icon: '🔴', color: 'red' },
          { label: 'Mídias', value: summary.total_media, icon: '📁', color: 'purple' },
          { label: 'Campanhas', value: summary.active_campaigns, icon: '📢', color: 'yellow' },
          { label: 'Reproduções', value: summary.total_plays, icon: '▶️', color: 'cyan' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs text-gray-400">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{card.value ?? 0}</div>
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
              {devices.map((d) => (
                <tr key={d.id as string} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.is_online ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.is_online ? 'bg-green-400' : 'bg-gray-500'}`} />
                      {d.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-white">{d.name as string}</td>
                  <td className="px-5 py-3 text-gray-300">{d.model as string}</td>
                  <td className="px-5 py-3 text-gray-400">{d.player_version as string}</td>
                  <td className="px-5 py-3 text-right text-green-400 font-medium">
                    {formatHours(d.uptime_hours as number)}
                  </td>
                  <td className="px-5 py-3 text-right text-white">{d.play_count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CampaignReport({ data }: { data: Record<string, unknown> }) {
  const campaigns = data.campaigns as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Total de reproduções: <span className="text-white font-semibold">{data.total_plays as number}</span>
      </div>

      {campaigns.map((c) => (
        <div key={c.id as string} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-lg">{c.name as string}</h3>
            <span className="text-blue-400 font-semibold">{c.plays as number} reproduções</span>
          </div>

          <div className="text-xs text-gray-500 mb-2">Top mídias:</div>
          <div className="space-y-1">
            {(c.top_media as Array<Record<string, unknown>>).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{m.name as string}</span>
                <span className="text-gray-500">{m.count as number}x</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500">Nenhum dado de campanha encontrado</div>
      )}
    </div>
  );
}

function ActivityReport({ data }: { data: Record<string, unknown> }) {
  const heatmap = data.heatmap as number[][];
  const hourlyTotal = data.hourly_total as number[];
  const dailyTotal = data.daily_total as number[];
  const deviceActivity = data.device_activity as Array<Record<string, unknown>>;

  const maxVal = Math.max(...heatmap.flat(), 1);

  return (
    <div className="space-y-6">
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
          {hourlyTotal.map((val, i) => {
            const maxH = Math.max(...hourlyTotal, 1);
            const height = (val / maxH) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${i}:00 - ${val}`}
                />
                <span className="text-[9px] text-gray-500">{i}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Device activity */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h2 className="font-semibold text-white mb-4">Atividade por Dispositivo</h2>
        <div className="space-y-2">
          {deviceActivity.map((d, i) => {
            const maxPlays = Math.max(...deviceActivity.map(x => x.plays as number), 1);
            const width = ((d.plays as number) / maxPlays) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-40 text-sm text-gray-300 truncate">{d.name as string}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-4">
                  <div className="bg-blue-500 rounded-full h-4 flex items-center justify-end pr-2" style={{ width: `${Math.max(width, 5)}%` }}>
                    <span className="text-[10px] text-white font-medium">{d.plays as number}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FinancialReport({ data, formatHours }: { data: Record<string, unknown>; formatHours: (h: number) => string }) {
  const partners = data.partners as Array<Record<string, unknown>>;
  const totalAmount = data.total_amount as number;
  const totalHours = data.total_hours as number;

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
          <div className="text-3xl font-bold text-yellow-400">R$ {totalAmount.toFixed(2)}</div>
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
              {partners.map((p, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white font-medium">{p.partner_id as string}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      p.payment_type === 'hourly' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'
                    }`}>
                      {p.payment_type === 'hourly' ? 'Por Hora' : 'Mensal'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{p.devices_count as number}</td>
                  <td className="px-5 py-3 text-right text-white">{formatHours(p.hours as number)}</td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {p.payment_type === 'hourly' ? `R$ ${(p.hourly_rate as number).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {p.payment_type === 'monthly' ? `R$ ${(p.monthly_rate as number).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-5 py-3 text-right text-yellow-400 font-semibold">
                    R$ {(p.estimated_amount as number).toFixed(2)}
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
