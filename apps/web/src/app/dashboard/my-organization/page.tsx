'use client';

import { useEffect, useState } from 'react';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: string;
  category_id: string | null;
  plan: string;
  city: string | null;
  state: string | null;
  address: string | null;
  primary_color: string | null;
  max_devices: number | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  is_global: boolean;
}

interface Device {
  id: string;
  name: string;
  status: string;
  last_heartbeat: string | null;
  campaign_name?: string;
  resolution?: string;
}

export default function MyOrganizationPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // Profile (to get user org + role)
      const profileRes = await fetch('/api/auth/profile');
      const profileJson = await profileRes.json();
      const profile = profileJson?.profile;
      if (!profile) { setError('Não foi possível carregar seu perfil.'); setLoading(false); return; }
      setIsSuperAdmin(profile.role === 'super_admin');
      if (!profile.organization_id) {
        setError('Você não está vinculado a nenhuma organização.');
        setLoading(false);
        return;
      }

      // Categories
      const catsRes = await fetch('/api/admin/categories/global');
      const catsJson = await catsRes.json();
      setCategories(catsJson.categories ?? []);

      // My org (use the organizations endpoint; crud filters to my org for non-super_admin)
      const orgsRes = await fetch('/api/admin/crud/organizations?order=name&asc=true&limit=10');
      const orgsJson = await orgsRes.json();
      const orgsList = (orgsJson.data ?? []) as Org[];
      const myOrg = orgsList.find(o => o.id === profile.organization_id) || orgsList[0];
      if (!myOrg) { setError('Organização não encontrada.'); setLoading(false); return; }

      // Enrich with category
      const catMap = new Map<string, Category>(((catsJson.categories ?? []) as Category[]).map(c => [c.id, c]));
      if (myOrg.category_id) {
        const c = catMap.get(myOrg.category_id);
        if (c) {
          myOrg.category_name = c.name;
          myOrg.category_icon = c.icon;
          myOrg.category_color = c.color;
        }
      }
      setOrg(myOrg);

      // My devices
      const devRes = await fetch(`/api/admin/crud/devices?organization_id=${myOrg.id}&order=name&asc=true&limit=100`);
      const devJson = await devRes.json();
      setDevices(devJson.data ?? []);
    } catch (e) {
      console.error(e);
      setError('Erro ao carregar dados da organização.');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setCategory(catId: string | null) {
    if (!org) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const r = await fetch('/api/admin/organizations/category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: org.id, category_id: catId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || 'Erro ao salvar');
      } else {
        setMessage('✓ Categoria atualizada! Mídias bloqueadas por essa categoria não vão mais aparecer aqui.');
        setTimeout(() => setMessage(null), 4000);
        await load();
      }
    } catch (e) {
      setError('Erro de conexão');
    }
    setSaving(false);
  }

  function timeSince(dateStr: string | null) {
    if (!dateStr) return 'Nunca';
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return `${s}s atrás`;
    if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
    if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
    return `${Math.floor(s / 86400)}d atrás`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mr-3" />
        Carregando...
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="rounded-xl bg-red-900/20 border border-red-800 p-6 text-red-300">
        <h2 className="font-semibold mb-1">⚠️ Erro</h2>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🏢 Minha Organização</h1>
        <p className="text-sm text-gray-500 mt-1">
          Defina o tipo do seu estabelecimento, gerencie sua categoria e veja seus terminais.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">{message}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Card: Info básica */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{
              backgroundColor: (org.primary_color || '#3b82f6') + '20',
              border: `2px solid ${org.primary_color || '#3b82f6'}`
            }}
          >
            🏢
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
            <p className="text-sm text-gray-500 font-mono">/{org.slug}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {org.status}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{org.plan}</span>
              {org.city && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">📍 {org.city}{org.state ? `/${org.state}` : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Card: Categoria (tipo de estabelecimento) */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">🏷️ Categoria do seu estabelecimento</h3>
          <p className="text-sm text-gray-500 mt-1">
            Define que tipo de negócio você é. Mídias bloqueadas pra esta categoria <b>NÃO</b> serão exibidas nos seus terminais.
          </p>
        </div>

        {org.category_id && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: (org.category_color || '#6b7280') + '20', color: org.category_color || '#374151' }}>
            <span>{org.category_icon}</span>
            <span>Categoria atual: {org.category_name}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            disabled={saving || !org.category_id}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100 disabled:opacity-40"
          >
            — Remover categoria
          </button>
          {categories.map((c) => {
            const selected = org.category_id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${selected ? 'text-white ring-2 ring-offset-2 ring-offset-white' : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'} disabled:opacity-50`}
                style={selected ? { backgroundColor: c.color, boxShadow: `0 0 0 2px ${c.color}` } : undefined}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
                {selected && <span>✓</span>}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          💡 <b>Por que isso importa?</b> Se você é uma Barbearia, marque "Barbearia". Assim, mídias marcadas com bloqueio de "Barbearia" (de concorrentes) não serão exibidas nos seus terminais.
        </p>
      </div>

      {/* Card: Terminais */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">📺 Meus Terminais</h3>
            <p className="text-sm text-gray-500 mt-1">
              TVs/dispositivos da sua organização. Limite do plano: {org.max_devices ?? '—'} terminais.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{devices.length}</span> cadastrado(s)
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Nenhum terminal cadastrado ainda. Acesse <a href="/dashboard/devices" className="text-blue-600 hover:underline">Dispositivos</a> pra cadastrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map(d => {
              const isOnline = d.last_heartbeat && (Date.now() - new Date(d.last_heartbeat).getTime() < 5 * 60 * 1000);
              return (
                <div key={d.id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm truncate">{d.name || `Device ${d.id.slice(0, 6)}`}</span>
                    <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  </div>
                  <p className="text-xs text-gray-500">📡 {timeSince(d.last_heartbeat)}</p>
                  {d.resolution && <p className="text-xs text-gray-500">🖥 {d.resolution}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card: Info do plano */}
      {org.plan && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
          💎 Plano atual: <b>{org.plan}</b> · Limite: <b>{org.max_devices ?? '—'}</b> terminais
        </div>
      )}
    </div>
  );
}
