'use client';

import { useEffect, useState, useCallback } from 'react';

interface Device {
  id: string;
  name: string;
  status: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  description: string | null;
  device_group_members: { id: string; device_id: string; devices: { name: string; status: string } | null }[];
}

interface Campaign { id: string; name: string; }

export default function DeviceGroupsPage() {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [assigningGroup, setAssigningGroup] = useState<string | null>(null);
  const [assignCampaign, setAssignCampaign] = useState('');

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [grpRes, devRes, campRes] = await Promise.all([
        fetch('/api/admin/device-groups'),
        fetch('/api/admin/devices'),
        fetch('/api/campaigns').catch(() => ({ json: () => ({ campaigns: [] }) })),
      ]);
      const grpData = await grpRes.json();
      const devData = await devRes.json();
      const campData = await campRes.json();
      setGroups(grpData.groups || []);
      setAllDevices(devData.devices || []);
      setCampaigns(campData.campaigns || []);
    } catch (e) {
      console.error('Failed to fetch data', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDevice = (id: string) => {
    setSelectedDevices(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const saveGroup = async () => {
    if (!formName.trim()) return;
    try {
      await fetch('/api/admin/device-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          device_ids: selectedDevices,
        }),
      });
      setShowForm(false);
      setFormName('');
      setFormDesc('');
      setSelectedDevices([]);
      fetchData();
    } catch (e) {
      console.error('Failed to save group', e);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Excluir este grupo?')) return;
    try {
      await fetch(`/api/admin/device-groups?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error('Failed to delete group', e);
    }
  };

  const getDeviceCount = (group: DeviceGroup) => {
    return group.device_group_members?.length || 0;
  };

  const assignCampaignToGroup = async (groupId: string) => {
    try {
      await fetch('/api/admin/device-groups/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, campaign_id: assignCampaign || null }),
      });
      setAssigningGroup(null);
      setAssignCampaign('');
      fetchData();
    } catch (e) {
      console.error('Failed to assign campaign', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos de Dispositivos</h1>
        <button
          onClick={() => { setFormName(''); setFormDesc(''); setSelectedDevices([]); setShowForm(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novo Grupo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Novo Grupo</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome *</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="TVs do Piso 1"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descrição</label>
              <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="Todos os TVs do primeiro andar"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Selecionar Dispositivos ({selectedDevices.length} selecionados)
            </label>
            <div className="max-h-60 overflow-y-auto rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-2">
              {allDevices.map((device) => (
                <label key={device.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(device.id)}
                    onChange={() => toggleDevice(device.id)}
                    className="rounded"
                  />
                  <span className="text-white text-sm">{device.name}</span>
                  <span className={`text-xs ${
                    device.status === 'active' ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    {device.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </label>
              ))}
              {allDevices.length === 0 && (
                <p className="text-gray-500 text-sm">Nenhum dispositivo encontrado</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={saveGroup}
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

      {/* Groups list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.id} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-400 mt-1">{group.description}</p>
                )}
              </div>
              <button onClick={() => deleteGroup(group.id)}
                className="text-red-400 hover:text-red-300 text-sm">
                Excluir
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Dispositivos</span>
                <span className="text-white font-medium">{getDeviceCount(group)}</span>
              </div>

              {group.device_group_members?.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    member.devices?.status === 'active' ? 'bg-green-400' : 'bg-gray-600'
                  }`} />
                  <span className="text-gray-300">{member.devices?.name || 'Desconhecido'}</span>
                </div>
              ))}
              {(group.device_group_members?.length || 0) > 5 && (
                <p className="text-xs text-gray-500">+{(group.device_group_members?.length || 0) - 5} mais</p>
              )}

              {/* Campaign Assignment */}
              <div className="pt-3 border-t border-gray-800">
                {assigningGroup === group.id ? (
                  <div className="flex gap-2">
                    <select
                      value={assignCampaign}
                      onChange={e => setAssignCampaign(e.target.value)}
                      className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"
                    >
                      <option value="">Nenhuma campanha</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button onClick={() => assignCampaignToGroup(group.id)}
                      className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
                      OK
                    </button>
                    <button onClick={() => setAssigningGroup(null)}
                      className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setAssigningGroup(group.id)}
                    className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1">
                    Atribuir campanha a todos
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {groups.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhum grupo criado
          </div>
        )}
      </div>
    </div>
  );
}
