'use client';

import { useEffect, useState, useCallback } from 'react';

interface UptimeSession {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  devices: { name: string; model: string } | null;
}

interface DeviceSummary {
  device: string;
  total_hours: number;
  days_online: number;
  daily: Record<string, number>;
}

interface PaymentSetting {
  id: string;
  partner_id: string;
  payment_type: string;
  hourly_rate: number;
  monthly_rate: number;
}

export default function UptimePage() {
  const [sessions, setSessions] = useState<UptimeSession[]>([]);
  const [summaries, setSummaries] = useState<DeviceSummary[]>([]);
  const [payments, setPayments] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/uptime?days=${days}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setSummaries(data.summaries || []);
      setPayments(data.payments || []);
    } catch (e) {
      console.error('Failed to fetch uptime data', e);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}min`;
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Uptime & Pagamento</h1>
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

      {/* Device summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((s) => {
          const payment = payments.find(p => p.partner_id);
          const estimated = payment?.payment_type === 'hourly'
            ? s.total_hours * (payment?.hourly_rate || 0)
            : (payment?.monthly_rate || 0) * Math.ceil(days / 30);

          return (
            <div key={s.device} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-lg">
                  📺
                </div>
                <div>
                  <h3 className="font-semibold text-white">{s.device}</h3>
                  <p className="text-xs text-gray-400">{s.days_online} dias ativos</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total online:</span>
                  <span className="text-green-400 font-semibold">{formatHours(s.total_hours)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Média diária:</span>
                  <span className="text-white">{formatHours(s.total_hours / Math.max(s.days_online, 1))}</span>
                </div>
                {payment && (
                  <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
                    <span className="text-gray-400">Valor estimado:</span>
                    <span className="text-yellow-400 font-semibold">
                      {payment.payment_type === 'hourly'
                        ? `${formatCurrency(estimated)} (${formatHours(s.total_hours)} × ${formatCurrency(payment.hourly_rate)}/h)`
                        : `${formatCurrency(estimated)} (mensal)`
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Daily bar chart */}
              <div className="mt-3 space-y-1">
                {Object.entries(s.daily).slice(-7).map(([date, hours]) => (
                  <div key={date} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-20">{date.slice(5)}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 rounded-full h-2 transition-all"
                        style={{ width: `${Math.min((hours / 24) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 w-12 text-right">{formatHours(hours)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {summaries.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhum dado de uptime encontrado
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="rounded-xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Sessões Recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left px-5 py-3">Dispositivo</th>
                <th className="text-left px-5 py-3">Início</th>
                <th className="text-left px-5 py-3">Fim</th>
                <th className="text-left px-5 py-3">Duração</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 50).map((s) => {
                const deviceName = (s.devices as Record<string, string>)?.name || s.device_id?.slice(0, 8);
                const duration = s.duration_seconds
                  ? formatHours(s.duration_seconds / 3600)
                  : 'Em andamento';
                const isActive = !s.ended_at;

                return (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-white">{deviceName}</td>
                    <td className="px-5 py-3 text-gray-300">
                      {new Date(s.started_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      {s.ended_at ? new Date(s.ended_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-5 py-3 text-white font-medium">{duration}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                        {isActive ? 'Online' : 'Offline'}
                      </span>
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
