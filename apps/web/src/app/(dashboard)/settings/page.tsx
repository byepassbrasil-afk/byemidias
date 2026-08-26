'use client';

import { useState, useEffect } from 'react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  phone: string | null;
  organization_id: string | null;
  created_at: string;
  org_name: string | null;
  org_slug: string | null;
  org_renewal_date: string | null;
  org_plan: string | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        setProfile(d.profile);
        setFullName(d.profile.full_name || '');
        setPhone(d.profile.phone || '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      if (res.ok) setMsg('Perfil atualizado!');
      else setMsg('Erro ao salvar');
    } catch {
      setMsg('Erro ao salvar');
    }
    setSaving(false);
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;
  if (!profile) return <div className="p-6 text-red-500">Erro ao carregar perfil</div>;

  const initials = profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
  };
  const planLabel: Record<string, string> = { free: 'Gratuito', basic: 'Básico', pro: 'Profissional', enterprise: 'Empresarial' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-5 mb-6">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">{initials}</div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
            <p className="text-gray-500">{profile.email}</p>
            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {roleLabel[profile.role] || profile.role}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={profile.email} disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500" />
          </div>
        </div>

        {msg && <p className={`mt-4 text-sm ${msg.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {profile.org_name && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Organização</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Nome</label>
              <p className="text-sm font-medium text-gray-900">{profile.org_name}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Plano</label>
              <p className="text-sm font-medium text-gray-900">{planLabel[profile.org_plan || ''] || profile.org_plan || 'Gratuito'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Renovação</label>
              <p className="text-sm font-medium text-gray-900">
                {profile.org_renewal_date ? new Date(profile.org_renewal_date).toLocaleDateString('pt-BR') : 'Sem data'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Membro desde</label>
              <p className="text-sm font-medium text-gray-900">
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
