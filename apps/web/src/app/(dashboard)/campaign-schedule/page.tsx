'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TimeSlot {
  id: string;
  campaign_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  playlist_id: string | null;
  priority: number;
  status: string;
}

interface Campaign { id: string; name: string; organization_id: string; }
interface Playlist { id: string; name: string; }

const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CampaignSchedulePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDay, setAddDay] = useState(0);
  const [addStartHour, setAddStartHour] = useState(8);
  const [addStartMin, setAddStartMin] = useState(0);
  const [addEndHour, setAddEndHour] = useState(12);
  const [addEndMin, setAddEndMin] = useState(0);
  const [addPlaylistId, setAddPlaylistId] = useState('');
  const [addPriority, setAddPriority] = useState(0);
  const [addStatus, setAddStatus] = useState('active');
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [campRes, plRes] = await Promise.all([
      supabase.from('campaigns').select('id, name, organization_id').in('status', ['active', 'draft']),
      supabase.from('playlists').select('id, name'),
    ]);
    setCampaigns((campRes.data ?? []) as Campaign[]);
    setPlaylists((plRes.data ?? []) as Playlist[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadSlots = useCallback(async () => {
    if (!selectedCampaign) { setSlots([]); return; }
    const res = await fetch(`/api/admin/time-slots?campaign_id=${selectedCampaign}`);
    const data = await res.json();
    setSlots(data.slots || []);
  }, [selectedCampaign]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function openAddModal(day: number, hour: number) {
    setEditSlot(null);
    setAddDay(day);
    setAddStartHour(hour);
    setAddStartMin(0);
    setAddEndHour(Math.min(hour + 1, 23));
    setAddEndMin(0);
    setAddPlaylistId('');
    setAddPriority(0);
    setAddStatus('active');
    setShowAddModal(true);
  }

  function openEditModal(slot: TimeSlot) {
    setEditSlot(slot);
    setAddDay(slot.day_of_week);
    const [sh, sm] = slot.start_time.split(':').map(Number);
    const [eh, em] = slot.end_time.split(':').map(Number);
    setAddStartHour(sh);
    setAddStartMin(sm || 0);
    setAddEndHour(eh);
    setAddEndMin(em || 0);
    setAddPlaylistId(slot.playlist_id || '');
    setAddPriority(slot.priority || 0);
    setAddStatus(slot.status || 'active');
    setShowAddModal(true);
  }

  async function handleSaveSlot() {
    if (!selectedCampaign) return;
    const startTime = `${String(addStartHour).padStart(2, '0')}:${String(addStartMin).padStart(2, '0')}:00`;
    const endTime = `${String(addEndHour).padStart(2, '0')}:${String(addEndMin).padStart(2, '0')}:00`;

    if (addStartHour > addEndHour || (addStartHour === addEndHour && addStartMin >= addEndMin)) {
      alert('Horario de fim deve ser depois do inicio');
      return;
    }

    const body = {
      ...(editSlot ? { id: editSlot.id } : {}),
      campaign_id: selectedCampaign,
      day_of_week: addDay,
      start_time: startTime,
      end_time: endTime,
      playlist_id: addPlaylistId || null,
      priority: addPriority,
      status: addStatus,
    };

    const method = editSlot ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/time-slots', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    setShowAddModal(false);
    setEditSlot(null);
    loadSlots();
  }

  async function handleDeleteSlot(id: string) {
    if (!confirm('Excluir este slot?')) return;
    await fetch(`/api/admin/time-slots?id=${id}`, { method: 'DELETE' });
    loadSlots();
  }

  function getPlaylistName(id: string | null) {
    if (!id) return 'Sem playlist';
    return playlists.find(p => p.id === id)?.name || 'Desconhecida';
  }

  function getSlotsForDay(day: number) {
    return slots.filter(s => s.day_of_week === day);
  }

  function getSlotStyle(slot: TimeSlot) {
    const [sh, sm] = slot.start_time.split(':').map(Number);
    const [eh, em] = slot.end_time.split(':').map(Number);
    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);
    const top = (startMinutes / (24 * 60)) * (24 * HOUR_HEIGHT);
    const height = ((endMinutes - startMinutes) / (24 * 60)) * (24 * HOUR_HEIGHT);
    return { top: `${top}px`, height: `${Math.max(height, 24)}px` };
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Programacao Semanal</h1>

      {/* Campaign selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">Campanha:</label>
        <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white min-w-[300px]">
          <option value="">Selecione uma campanha...</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCampaign && (
          <button onClick={() => openAddModal(0, 8)}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            + Novo Slot
          </button>
        )}
      </div>

      {/* Weekly calendar */}
      {selectedCampaign && (
        <div className="overflow-x-auto rounded-xl bg-gray-900 border border-gray-800">
          <div className="min-w-[960px] flex">
            {/* Hour column */}
            <div className="w-[50px] flex-shrink-0">
              <div className="h-[40px] border-b border-gray-700" />
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-gray-800/50 pr-2 flex items-start justify-end">
                  <span className="text-[11px] text-gray-500 -mt-1.5">{String(h).padStart(2, '0')}h</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((day, dayIdx) => {
              const daySlots = getSlotsForDay(dayIdx);
              return (
                <div key={dayIdx} className="flex-1 border-l border-gray-700/50">
                  {/* Day header */}
                  <div className="h-[40px] border-b border-gray-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{day}</span>
                    <span className="text-[10px] text-gray-500 ml-1">({daySlots.length})</span>
                  </div>
                  {/* Hours grid */}
                  <div className="relative">
                    {HOURS.map(h => (
                      <div key={h} style={{ height: HOUR_HEIGHT }}
                        className="border-b border-gray-800/50 hover:bg-gray-800/20 cursor-pointer transition-colors"
                        onClick={() => openAddModal(dayIdx, h)} />
                    ))}
                    {/* Slots overlay */}
                    {daySlots.map(slot => {
                      const style = getSlotStyle(slot);
                      const [sh, sm] = slot.start_time.split(':').map(Number);
                      const [eh, em] = slot.end_time.split(':').map(Number);
                      const durH = eh - sh;
                      const durM = (em || 0) - (sm || 0);
                      const durText = durH > 0 ? `${durH}h${durM !== 0 ? `${durM}m` : ''}` : `${durM}m`;
                      return (
                        <div key={slot.id}
                          className="absolute left-0.5 right-0.5 rounded bg-blue-600/90 border border-blue-400/30 p-1.5 text-[10px] text-white cursor-pointer hover:bg-blue-500 transition-colors overflow-hidden z-10"
                          style={style}
                          onClick={e => { e.stopPropagation(); openEditModal(slot); }}>
                          <div className="font-bold truncate">{getPlaylistName(slot.playlist_id)}</div>
                          <div className="opacity-70">{String(sh).padStart(2, '0')}:{String(sm || 0).padStart(2, '0')} - {String(eh).padStart(2, '0')}:{String(em || 0).padStart(2, '0')} ({durText})</div>
                          {slot.priority ? <div className="opacity-50">Prioridade {slot.priority}</div> : null}
                          {slot.status !== 'active' && <div className="text-yellow-300 opacity-70">{slot.status}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedCampaign && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-12 text-center">
          <p className="text-gray-500">Selecione uma campanha para ver/editar a programacao semanal.</p>
          <p className="text-xs text-gray-600 mt-2">Clique em &quot;+ Novo Slot&quot; ou clique numa célula para adicionar.</p>
        </div>
      )}

      {/* Add/Edit slot modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setShowAddModal(false); setEditSlot(null); }}>
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-700" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">{editSlot ? 'Editar Slot' : 'Novo Slot de Horario'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Dia da Semana</label>
                <select value={addDay} onChange={e => setAddDay(+e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Inicio</label>
                  <div className="flex gap-1">
                    <select value={addStartHour} onChange={e => setAddStartHour(+e.target.value)}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-2 text-white text-sm">
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                    </select>
                    <span className="text-gray-500 self-center">:</span>
                    <select value={addStartMin} onChange={e => setAddStartMin(+e.target.value)}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-2 text-white text-sm">
                      {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fim</label>
                  <div className="flex gap-1">
                    <select value={addEndHour} onChange={e => setAddEndHour(+e.target.value)}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-2 text-white text-sm">
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                    </select>
                    <span className="text-gray-500 self-center">:</span>
                    <select value={addEndMin} onChange={e => setAddEndMin(+e.target.value)}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-2 text-white text-sm">
                      {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Playlist</label>
                <select value={addPlaylistId} onChange={e => setAddPlaylistId(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                  <option value="">Nenhuma (padrao da campanha)</option>
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                  <input type="number" value={addPriority} onChange={e => setAddPriority(+e.target.value)} min={0} max={10}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={addStatus} onChange={e => setAddStatus(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white">
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveSlot}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                {editSlot ? 'Salvar' : 'Adicionar'}
              </button>
              {editSlot && (
                <button onClick={() => { if (confirm('Excluir este slot?')) { handleDeleteSlot(editSlot.id); setShowAddModal(false); setEditSlot(null); } }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  Excluir
                </button>
              )}
              <button onClick={() => { setShowAddModal(false); setEditSlot(null); }}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
