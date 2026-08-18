'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Device } from '@byemidias/shared';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [deviceUuid, setDeviceUuid] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => { loadDevices(); loadOrgs(); loadUnits(); }, []);

  async function loadDevices() {
    const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
    setDevices(data ?? []);
    setLoading(false);
  }

  async function loadOrgs() {
    const { data } = await supabase.from('organizations').select('id, name');
    setOrgs((data ?? []) as { id: string; name: string }[]);
  }

  async function loadUnits() {
    const { data } = await supabase.from('units').select('id, name');
    setUnits((data ?? []) as { id: string; name: string }[]);
  }

  function resetForm() {
    setName(''); setModel(''); setDeviceUuid(''); setOrganizationId(''); setUnitId(''); setOrientation('landscape'); setEditing(null); setShowForm(false);
  }

  function startEdit(d: Device) {
    setEditing(d); setName(d.name); setModel(d.model || ''); setDeviceUuid(d.device_uuid); setOrganizationId(d.organization_id); setUnitId(d.unit_id || ''); setOrientation(d.orientation || 'landscape'); setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, model: model || null, device_uuid: deviceUuid, organization_id: organizationId, unit_id: unitId || null, orientation, updated_at: new Date().toISOString() };
    if (editing) {
      await supabase.from('devices').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('devices').insert({ ...payload, status: 'inactive', is_activated: false });
    }
    resetForm(); setSaving(false); loadDevices();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('devices').delete().eq('id', deleteId);
    setDeleteId(null); loadDevices();
  }

  const statusColors: Record<string, string> = {
    online: 'bg-green-100 text-green-800', offline: 'bg-red-100 text-red-800', syncing: 'bg-yellow-100 text-yellow-800', error: 'bg-red-100 text-red-800', inactive: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispositivos</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Novo Dispositivo</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Dispositivo' : 'Novo Dispositivo'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UUID do Dispositivo</label>
              <input value={deviceUuid} onChange={(e) => setDeviceUuid(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Ex: ABCD-1234-EFGH-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
              <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">Selecione...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">Nenhuma</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orientação</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-50 p-6 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir este dispositivo?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhum dispositivo encontrado.</p></div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UUID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Heartbeat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{device.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{device.device_uuid?.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{device.model || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[device.status] ?? 'bg-gray-100 text-gray-800'}`}>{device.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString('pt-BR') : 'Nunca'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => startEdit(device)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Editar</button>
                    <button onClick={() => setDeleteId(device.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
