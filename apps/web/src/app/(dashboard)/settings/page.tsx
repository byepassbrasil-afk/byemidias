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
  const [pushStatus, setPushStatus] = useState<'loading' | 'granted' | 'denied' | 'unsupported'>('loading');
  const [pushSubscribed, setPushSubscribed] = useState(false);

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

  // Check push status
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      return;
    }
    setPushStatus(Notification.permission);
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setPushSubscribed(!!sub);
      });
    }).catch(() => {});
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

  async function handleEnablePush() {
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const res = await fetch('/api/push/vapid-key');
        const { publicKey } = await res.json();
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
        const keys = sub.toJSON().keys;
        if (keys) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint, keys }),
          });
          setPushSubscribed(true);
        }
      }
    } catch (e) {
      console.error('Push subscribe error:', e);
    }
  }

  async function handleDisablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
        await sub.unsubscribe();
        setPushSubscribed(false);
      }
    } catch (e) {
      console.error('Push unsubscribe error:', e);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;
  if (!profile) return <div className="p-6 text-red-500">Erro ao carregar perfil</div>;

  const initials = profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
  };
  const planLabel: Record<string, string> = { free: 'Gratuito', basic: 'Básico', pro: 'Profissional', enterprise: 'Empresarial' };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

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

      {/* Push Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notificações Push</h3>
        <p className="text-sm text-gray-500 mb-4">Receba alertas no navegador quando dispositivos ficarem offline ou online.</p>
        {pushStatus === 'unsupported' ? (
          <p className="text-sm text-gray-400">Seu navegador não suporta notificações push.</p>
        ) : pushStatus === 'denied' ? (
          <p className="text-sm text-amber-600">Notificações bloqueadas. Habilite nas configurações do navegador.</p>
        ) : pushSubscribed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm text-green-700 font-medium">Ativo</span>
            </div>
            <button onClick={handleDisablePush} className="text-sm text-red-600 hover:text-red-800 font-medium">Desativar</button>
          </div>
        ) : (
          <button onClick={handleEnablePush} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Ativar Notificações
          </button>
        )}
      </div>
    </div>
  );
}
