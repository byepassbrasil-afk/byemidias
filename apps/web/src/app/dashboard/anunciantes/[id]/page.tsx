'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type TabKey = 'cadastro' | 'midias' | 'historico' | 'pagamentos' | 'terminais';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'cadastro', label: 'Cadastro', icon: '🏢' },
  { key: 'midias', label: 'Mídias', icon: '📁' },
  { key: 'historico', label: 'Histórico', icon: '📢' },
  { key: 'pagamentos', label: 'Pagamentos', icon: '💰' },
  { key: 'terminais', label: 'Terminais', icon: '📺' },
];

const BRAND = '#ee6a1e';

interface Advertiser {
  id: string;
  name: string;
  establishment_name: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  ticket_value: number;
  status: string;
  organization_id: string;
  organization_name: string;
  device_count: number;
  media_count: number;
}

interface AdvertiserMedia {
  id: string;
  name: string;
  file_url: string;
  type: string;
  created_at: string;
}

interface AdvertiserInvoice {
  id: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface DeviceContracted {
  id: string;
  name: string;
  establishment_name: string | null;
  model: string | null;
  is_online: boolean;
  contracted_at: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface OrgDevice {
  id: string;
  name: string;
  establishment_name: string | null;
  model: string | null;
  is_online: boolean;
}

export default function AdvertiserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('cadastro');
  const [loading, setLoading] = useState(true);

  // Cadastro
  const [form, setForm] = useState({ name: '', establishment_name: '', email: '', phone: '', document: '', address: '', ticket_value: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [cadastroMsg, setCadastroMsg] = useState('');

  // Mídias
  const [media, setMedia] = useState<AdvertiserMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [addingMedia, setAddingMedia] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [libraryMedia, setLibraryMedia] = useState<Array<{id: string; name: string; file_url: string; type: string}>>([]);
  const [librarySearch, setLibrarySearch] = useState('');

  // Histórico
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Pagamentos
  const [invoices, setInvoices] = useState<AdvertiserInvoice[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invForm, setInvForm] = useState({ period_start: '', period_end: '', amount: '', due_date: '' });
  const [creatingInv, setCreatingInv] = useState(false);

  // Terminais
  const [contractedDevices, setContractedDevices] = useState<DeviceContracted[]>([]);
  const [orgDevices, setOrgDevices] = useState<OrgDevice[]>([]);
  const [savingDevices, setSavingDevices] = useState(false);

  const loadAdvertiser = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}`);
      const json = await res.json();
      if (json.advertiser) {
        const adv = json.advertiser;
        setAdvertiser(adv);
        setForm({
          name: adv.name || '',
          establishment_name: adv.establishment_name || '',
          email: adv.email || '',
          phone: adv.phone || '',
          document: adv.document || '',
          address: adv.address || '',
          ticket_value: adv.ticket_value || '',
          status: adv.status || '',
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}/media`);
      const json = await res.json();
      setMedia(json.media || []);
    } catch (e) { console.error(e); }
    setMediaLoading(false);
  }, [id]);

  const openMediaPicker = useCallback(async () => {
    if (!advertiser) return;
    if (!advertiser.organization_id) {
      alert('Erro: anunciante sem organização. Recarregue a página.');
      return;
    }
    setLibraryMedia([]); // reset before open to avoid stale content
    setShowMediaPicker(true);
    try {
      const res = await fetch(`/api/dashboard/crud/media?organization_id=${advertiser.organization_id}&limit=100`);
      const json = await res.json();
      console.log('[mediaPicker] org_id:', advertiser.organization_id, 'response:', json);
      setLibraryMedia(Array.isArray(json.data) ? json.data : (json.data?.records || []));
    } catch (e) { console.error(e); }
  }, [advertiser]);

  const loadCampaigns = useCallback(async () => {
    if (!advertiser) return;
    try {
      const res = await fetch(`/api/dashboard/crud/campaigns?organization_id=${advertiser.organization_id}`);
      const json = await res.json();
      setCampaigns(Array.isArray(json.data) ? json.data : (json.data?.records || []));
    } catch (e) { console.error(e); }
  }, [advertiser]);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}/invoices`);
      const json = await res.json();
      setInvoices(json.invoices || []);
    } catch (e) { console.error(e); }
  }, [id]);

  const loadDevices = useCallback(async () => {
    if (!advertiser) return;
    try {
      const [contractedRes, orgRes] = await Promise.all([
        fetch(`/api/dashboard/advertisers/${id}/devices`),
        fetch(`/api/dashboard/crud/devices?organization_id=${advertiser.organization_id}`),
      ]);
      const contractedJson = await contractedRes.json();
      const orgJson = await orgRes.json();
      setContractedDevices(contractedJson.devices || []);
      setOrgDevices(orgJson.data?.records || []);
    } catch (e) { console.error(e); }
  }, [advertiser, id]);

  useEffect(() => { loadAdvertiser(); }, [loadAdvertiser]);

  useEffect(() => {
    if (!advertiser) return;
    if (activeTab === 'midias') loadMedia();
    if (activeTab === 'historico') loadCampaigns();
    if (activeTab === 'pagamentos') loadInvoices();
    if (activeTab === 'terminais') loadDevices();
  }, [activeTab, advertiser, loadMedia, loadCampaigns, loadInvoices, loadDevices]);

  // === CADASTRO ===
  const handleSaveCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCadastroMsg('');
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ticket_value: parseFloat(form.ticket_value) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) { setCadastroMsg(json.error || 'Erro'); return; }
      setCadastroMsg('Salvo com sucesso!');
      loadAdvertiser();
    } catch (e: any) { setCadastroMsg(e.message); }
    setSaving(false);
  };

  // === MÍDIAS ===
  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaName || !newMediaUrl) return;
    setAddingMedia(true);
    try {
      await fetch(`/api/dashboard/advertisers/${id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMediaName, file_url: newMediaUrl, type: mediaType }),
      });
      setNewMediaName('');
      setNewMediaUrl('');
      loadMedia();
    } catch (e) { console.error(e); }
    setAddingMedia(false);
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Remover esta mídia?')) return;
    await fetch(`/api/dashboard/advertisers/${id}/media?media_id=${mediaId}`, { method: 'DELETE' });
    loadMedia();
  };

  // === FATURAS ===
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInv(true);
    try {
      await fetch(`/api/dashboard/advertisers/${id}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...invForm, amount: parseFloat(invForm.amount) || 0 }),
      });
      setShowInvoiceForm(false);
      setInvForm({ period_start: '', period_end: '', amount: '', due_date: '' });
      loadInvoices();
    } catch (e) { console.error(e); }
    setCreatingInv(false);
  };

  const handleUpdateInvoiceStatus = async (invId: string, status: string) => {
    // Optimistic update
    setInvoices(prev => prev.map(inv => inv.id === invId ? { ...inv, status } : inv));
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}/invoices/${invId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) console.error('Failed to update status');
    } catch (e) {
      console.error('Error updating invoice status:', e);
      loadInvoices(); // revert on error
    }
  };

  const handleGenerateBoleto = async (invId: string) => {
    try {
      const res = await fetch(`/api/dashboard/advertisers/${id}/invoices/${invId}/boleto`);
      const json = await res.json();
      if (json.pdf_url) {
        window.open(json.pdf_url, '_blank');
      } else {
        alert(json.error || 'Erro ao gerar boleto');
      }
    } catch (e) { alert('Erro ao gerar boleto'); }
  };

  // === TERMINAIS ===
  const handleSaveDevices = async (deviceIds: string[]) => {
    setSavingDevices(true);
    try {
      await fetch(`/api/dashboard/advertisers/${id}/devices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: deviceIds }),
      });
      loadDevices();
    } catch (e) { console.error(e); }
    setSavingDevices(false);
  };

  const formatCurrency = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;
  if (!advertiser) return <div className="p-8 text-center text-gray-500">Anunciante não encontrado.</div>;

  const contractedIds = new Set(contractedDevices.map(d => d.id));

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/dashboard/anunciantes" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
        ← Anunciantes
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{advertiser.name}</h1>
          {advertiser.establishment_name && (
            <p className="text-sm text-gray-400 mt-0.5">{advertiser.establishment_name}</p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${
          advertiser.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
        }`}>
          {advertiser.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            style={activeTab === tab.key ? { backgroundColor: BRAND } : {}}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: CADASTRO === */}
      {activeTab === 'cadastro' && (
        <form onSubmit={handleSaveCadastro} className="rounded-xl bg-gray-900 border border-gray-800 p-6 max-w-2xl space-y-4">
          {cadastroMsg && <p className={`text-sm ${cadastroMsg.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>{cadastroMsg}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Estabelecimento</label>
              <input value={form.establishment_name} onChange={e => setForm(f => ({ ...f, establishment_name: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Telefone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">CNPJ/CPF</label>
              <input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ticket (R$)</label>
              <input type="number" step="0.01" value={form.ticket_value} onChange={e => setForm(f => ({ ...f, ticket_value: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Endereço</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: BRAND }}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}

      {/* === TAB: MÍDIAS === */}
      {activeTab === 'midias' && (
        <div className="space-y-4">
          {/* Add media button */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-sm text-gray-400 mb-3">Vincule mídias da sua biblioteca a este anunciante.</p>
            <button onClick={openMediaPicker}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium"
              style={{ backgroundColor: BRAND }}>
              📁 Selecionar da Biblioteca
            </button>
          </div>

          {/* Media list */}
          {mediaLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : media.length === 0 ? (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center text-gray-500">
              Nenhuma mídia cadastrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.map(m => (
                <div key={m.id} className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                  {m.type === 'image' ? (
                    <img src={m.file_url} alt={m.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-gray-800 flex items-center justify-center text-gray-500 text-sm">🎬 {m.type}</div>
                  )}
                  <div className="p-3">
                    <p className="text-sm text-white font-medium truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(m.created_at)}</p>
                    <button onClick={() => handleDeleteMedia(m.id)}
                      className="mt-2 text-xs text-red-400 hover:text-red-300">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB: HISTÓRICO === */}
      {activeTab === 'historico' && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma campanha encontrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left px-4 py-3">Campanha</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Início</th>
                  <th className="text-left px-4 py-3">Término</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-white">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        c.status === 'active' ? 'bg-green-900/50 text-green-400' : c.status === 'draft' ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 text-gray-300'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(c.start_date)}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(c.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* === TAB: PAGAMENTOS === */}
      {activeTab === 'pagamentos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowInvoiceForm(true)}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium"
              style={{ backgroundColor: BRAND }}>
              + Gerar Fatura
            </button>
          </div>

          {showInvoiceForm && (
            <form onSubmit={handleCreateInvoice} className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Nova Fatura</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Início do período</label>
                  <input type="date" required value={invForm.period_start} onChange={e => setInvForm(f => ({ ...f, period_start: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fim do período</label>
                  <input type="date" value={invForm.period_end} onChange={e => setInvForm(f => ({ ...f, period_end: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" required value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vencimento</label>
                  <input type="date" value={invForm.due_date} onChange={e => setInvForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creatingInv}
                  className="rounded-lg px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: BRAND }}>
                  {creatingInv ? '...' : 'Criar Fatura'}
                </button>
                <button type="button" onClick={() => setShowInvoiceForm(false)}
                  className="rounded-lg px-4 py-2 text-gray-400 text-sm">Cancelar</button>
              </div>
            </form>
          )}

          <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhuma fatura gerada.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800 bg-gray-800/50">
                    <th className="text-left px-4 py-3">Período</th>
                    <th className="text-left px-4 py-3">Valor</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white">
                        {formatDate(inv.period_start)}{inv.period_end ? ` a ${formatDate(inv.period_end)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-orange-400 font-semibold">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3">
                        <select value={inv.status} onChange={e => handleUpdateInvoiceStatus(inv.id, e.target.value)}
                          className={`rounded px-2 py-0.5 text-xs border ${
                            inv.status === 'paid' ? 'border-green-700 text-green-400 bg-green-900/20' :
                            inv.status === 'sent' ? 'border-blue-700 text-blue-400 bg-blue-900/20' :
                            'border-gray-700 text-gray-400 bg-gray-800'
                          }`}>
                          <option value="draft">Rascunho</option>
                          <option value="sent">Enviado</option>
                          <option value="paid">Pago</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleGenerateBoleto(inv.id)}
                          className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 mr-1">
                          📄 Boleto
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* === TAB:TERMINAIS === */}
      {activeTab === 'terminais' && (
        <div className="space-y-4">
          {contractedDevices.length > 0 && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Contratados ({contractedDevices.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contractedDevices.map(d => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-3">
                    <span className={`w-2 h-2 rounded-full ${d.is_online ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{d.name}</p>
                      {d.establishment_name && <p className="text-xs text-gray-500 truncate">{d.establishment_name}</p>}
                    </div>
                    <span className="text-xs text-gray-500">{d.model || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Vincular Terminais</h3>
            <p className="text-xs text-gray-500 mb-3">Selecione os dispositivos que serão usados para exibir anúncios deste cliente.</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {orgDevices.map(d => (
                <label key={d.id} className="flex items-center gap-3 rounded-lg bg-gray-800/30 p-2 cursor-pointer hover:bg-gray-800/60">
                  <input type="checkbox" defaultChecked={contractedIds.has(d.id)}
                    onChange={(e) => {
                      if (e.target.checked) contractedIds.add(d.id);
                      else contractedIds.delete(d.id);
                    }}
                    className="rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{d.name}</p>
                    {d.establishment_name && <p className="text-xs text-gray-500">{d.establishment_name}</p>}
                  </div>
                  <span className={`text-xs ${d.is_online ? 'text-green-400' : 'text-gray-500'}`}>
                    {d.is_online ? '🟢 Online' : '⚫ Offline'}
                  </span>
                </label>
              ))}
              {orgDevices.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Nenhum dispositivo disponível na organização.</p>}
            </div>
            <button onClick={() => handleSaveDevices(Array.from(contractedIds))}
              disabled={savingDevices}
              className="mt-3 rounded-lg px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: BRAND }}>
              {savingDevices ? 'Salvando...' : 'Salvar Terminais'}
            </button>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-gray-900 border border-gray-700 w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Selecionar da Biblioteca</h2>
              <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-4 border-b border-gray-800">
              <input
                type="text"
                placeholder="Buscar mídia..."
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {libraryMedia.length === 0 ? (
                <div className="text-center py-12 text-gray-500">Nenhuma mídia na biblioteca.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {libraryMedia
                    .filter(m => !librarySearch || m.name.toLowerCase().includes(librarySearch.toLowerCase()))
                    .map(m => (
                      <div key={m.id}
                        className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden cursor-pointer hover:border-orange-500 transition-colors"
                        onClick={async () => {
                          setAddingMedia(true);
                          try {
                            await fetch(`/api/dashboard/advertisers/${id}/media`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: m.name, file_url: m.file_url, type: m.type }),
                            });
                            setShowMediaPicker(false);
                            loadMedia();
                          } catch (e) { console.error(e); }
                          setAddingMedia(false);
                        }}>
                        {m.type === 'image' ? (
                          <img src={m.file_url} alt={m.name} className="w-full h-24 object-cover" />
                        ) : (
                          <div className="w-full h-24 bg-gray-700 flex items-center justify-center text-gray-400 text-2xl">🎬</div>
                        )}
                        <div className="p-2">
                          <p className="text-xs text-white truncate">{m.name}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
