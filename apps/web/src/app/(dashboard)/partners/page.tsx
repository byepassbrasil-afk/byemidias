'use client';

import { useEffect, useState } from 'react';

interface PartnerDevice {
  id: string;
  device_id: string;
  playlist_id: string | null;
}

interface Partner {
  id: string;
  username: string;
  display_name: string;
  status: string;
  created_at: string;
  partner_devices: PartnerDevice[];
}

interface SimpleItem {
  id: string;
  name: string;
}

function safeParseDevices(raw: unknown): PartnerDevice[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as PartnerDevice[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as PartnerDevice[]; } catch { return []; }
  }
  return [];
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [allDevices, setAllDevices] = useState<SimpleItem[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<SimpleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const [selectedDevices, setSelectedDevices] = useState<Record<string, string>>({});
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setError(null);
      const [partnersRes, devicesRes, playlistsRes, profileRes] = await Promise.all([
        fetch('/api/admin/partners').catch(() => null),
        fetch('/api/admin/crud/devices?order=name&asc=true').catch(() => null),
        fetch('/api/admin/crud/playlists?order=name&asc=true').catch(() => null),
        fetch('/api/auth/profile').catch(() => null),
      ]);

      if (partnersRes && partnersRes.ok) {
        const data = await partnersRes.json();
        const list = (data.partners ?? []).map((p: Record<string, unknown>) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name || p.name || '',
          status: p.status,
          created_at: p.created_at,
          partner_devices: safeParseDevices(p.partner_devices),
        }));
        setPartners(list);
      } else {
        setPartners([]);
      }

      if (devicesRes && devicesRes.ok) {
        const d = await devicesRes.json();
        setAllDevices(d.data ?? []);
      }

      if (playlistsRes && playlistsRes.ok) {
        const p = await playlistsRes.json();
        setAllPlaylists(p.data ?? []);
      }

      if (profileRes && profileRes.ok) {
        const prof = await profileRes.json();
        if (prof.profile?.org_slug) setOrgSlug(prof.profile.org_slug);
      }
    } catch (e) {
      console.error('loadData error:', e);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, display_name: displayName, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert('Erro ao criar parceiro: ' + (data.error || 'Erro desconhecido'));
      return;
    }

    setUsername('');
    setDisplayName('');
    setPassword('');
    setShowForm(false);
    loadData();
  }

  async function handleToggleStatus(partner: Partner) {
    const newStatus = partner.status === 'active' ? 'inactive' : 'active';
    await fetch(`/api/admin/partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza? Isso removerá o parceiro e seus acessos.')) return;
    await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' });
    loadData();
  }

  function openAssign(partner: Partner) {
    setShowAssign(partner.id);
    const initial: Record<string, string> = {};
    (partner.partner_devices || []).forEach((pd) => {
      initial[pd.device_id] = pd.playlist_id ?? '';
    });
    setSelectedDevices(initial);
  }

  async function handleSaveDevices() {
    if (!showAssign) return;
    const devices = Object.entries(selectedDevices).map(([device_id, playlist_id]) => ({
      device_id,
      playlist_id: playlist_id || null,
    }));

    await fetch('/api/admin/partners/devices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: showAssign, devices }),
    });

    setShowAssign(null);
    loadData();
  }

  function copyPartnerLink() {
    const slug = orgSlug || 'org';
    const url = `${window.location.origin}/partner/${slug}/login`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Parceiros</h1>
        <div className="flex gap-2">
          <button
            onClick={copyPartnerLink}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copiedLink ? '✓ Copiado!' : '🔗 Copiar Link de Acesso'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? 'Cancelar' : '+ Novo Parceiro'}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Link de acesso para parceiros:</strong>{' '}
          <code className="rounded bg-blue-100 px-2 py-0.5 text-xs">byemidias.vercel.app/partner/{orgSlug || 'sua-org'}/login</code>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Cada organização tem seu link exclusivo. Compartilhe com o parceiro correto.
        </p>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome de exibição</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                placeholder="Mercado do João"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (login)</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required
                placeholder="mercadodojoao"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                minLength={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" />
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Criar Parceiro
          </button>
        </form>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Atribuir Dispositivos</h2>
            <p className="text-sm text-gray-500 mb-4">Selecione os dispositivos que o parceiro pode gerenciar:</p>
            <div className="space-y-3">
              {allDevices.map((device) => (
                <div key={device.id} className="flex items-center gap-4 rounded-lg border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    checked={device.id in selectedDevices}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDevices((prev) => ({ ...prev, [device.id]: '' }));
                      } else {
                        setSelectedDevices((prev) => {
                          const next = { ...prev };
                          delete next[device.id];
                          return next;
                        });
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{device.name}</p>
                  </div>
                  {device.id in selectedDevices && (
                    <select
                      value={selectedDevices[device.id]}
                      onChange={(e) => setSelectedDevices((prev) => ({ ...prev, [device.id]: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Sem playlist vinculada</option>
                      {allPlaylists.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAssign(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={handleSaveDevices} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error} <button onClick={loadData} className="underline ml-2">Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : partners.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-gray-200">
          <p className="text-gray-500">Nenhum parceiro cadastrado.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{partner.display_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{partner.username}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {partner.partner_devices?.length || 0} dispositivo(s)
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      partner.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {partner.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(partner.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openAssign(partner)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        Dispositivos
                      </button>
                      <button onClick={() => handleToggleStatus(partner)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        {partner.status === 'active' ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => handleDelete(partner.id)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                        Excluir
                      </button>
                    </div>
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
