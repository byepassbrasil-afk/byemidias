'use client';

import { useEffect, useState, useCallback } from 'react';

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  campaign_id: string | null;
  playlist_id: string | null;
  sync_type: string;
  sync_interval_minutes: number;
  sync_days: number[];
  sync_start_time: string;
  sync_end_time: string;
  priority: number;
  is_active: boolean;
  last_sync_at: string | null;
  next_sync_at: string | null;
  campaigns: { name: string } | null;
  playlists: { name: string } | null;
}

interface Campaign { id: string; name: string; }
interface Playlist { id: string; name: string; }

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formPlaylist, setFormPlaylist] = useState('');
  const [formSyncType, setFormSyncType] = useState('periodic');
  const [formInterval, setFormInterval] = useState(15);
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [formStartTime, setFormStartTime] = useState('00:00');
  const [formEndTime, setFormEndTime] = useState('23:59');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const schedRes = await fetch('/api/admin/schedules');
      const schedData = await schedRes.json();
      setSchedules(schedData.schedules || []);
    } catch (e) {
      console.error('Failed to fetch data', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDay = (day: number) => {
    setFormDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const saveSchedule = async () => {
    if (!formName.trim()) return;
    try {
      await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          campaign_id: formCampaign || null,
          playlist_id: formPlaylist || null,
          sync_type: formSyncType,
          sync_interval_minutes: formInterval,
          sync_days: formDays,
          sync_start_time: formStartTime,
          sync_end_time: formEndTime,
        }),
      });
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (e) {
      console.error('Failed to save schedule', e);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Excluir este agendamento?')) return;
    try {
      await fetch(`/api/admin/schedules?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error('Failed to delete schedule', e);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormCampaign('');
    setFormPlaylist('');
    setFormSyncType('periodic');
    setFormInterval(15);
    setFormDays([1, 2, 3, 4, 5, 6, 7]);
    setFormStartTime('00:00');
    setFormEndTime('23:59');
  };

  const formatInterval = (min: number) => {
    if (min < 60) return `${min}min`;
    return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agendamento</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novo Agendamento
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Novo Agendamento</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome *</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Sync Diário"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descrição</label>
              <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="Atualização diária de conteúdo"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo de Sincronização</label>
              <select value={formSyncType} onChange={e => setFormSyncType(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                <option value="periodic">Periódico</option>
                <option value="specific">Horário Específico</option>
                <option value="always">Sempre Ativo</option>
              </select>
            </div>
            {formSyncType === 'periodic' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Intervalo (minutos)</label>
                <input type="number" value={formInterval} onChange={e => setFormInterval(parseInt(e.target.value) || 15)}
                  min={5} step={5}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
              </div>
            )}
          </div>

          {formSyncType === 'specific' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Horário Início</label>
                <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Horário Fim</label>
                <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Dias da Semana</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    formDays.includes(i)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={saveSchedule}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Salvar
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      <div className="rounded-xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Agendamentos Ativos</h2>
        </div>
        <div className="divide-y divide-gray-800/50">
          {schedules.map((s) => (
            <div key={s.id} className="px-5 py-4 hover:bg-gray-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    s.is_active ? 'bg-green-900/50' : 'bg-gray-800'
                  }`}>
                    {s.sync_type === 'always' ? '🔄' : s.sync_type === 'periodic' ? '⏰' : '📅'}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{s.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>
                        {s.sync_type === 'always' ? 'Sempre ativo' :
                         s.sync_type === 'periodic' ? `A cada ${formatInterval(s.sync_interval_minutes)}` :
                         `${s.sync_start_time} - ${s.sync_end_time}`}
                      </span>
                      <span>•</span>
                      <span>{s.sync_days.map(d => DAYS[d]).join(', ')}</span>
                      {s.campaigns && (
                        <>
                          <span>•</span>
                          <span className="text-blue-400">Campanha: {s.campaigns.name}</span>
                        </>
                      )}
                      {s.playlists && (
                        <>
                          <span>•</span>
                          <span className="text-purple-400">Playlist: {s.playlists.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button onClick={() => deleteSchedule(s.id)}
                    className="text-red-400 hover:text-red-300 text-sm">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}

          {schedules.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              Nenhum agendamento configurado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
