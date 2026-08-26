'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface UserProfile {
  full_name: string;
  role: string;
  avatar_url: string | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  device_id: string | null;
  device_name: string | null;
  read: boolean;
  created_at: string;
}

interface HeaderProps {
  onToggleMobile: () => void;
}

export function Header({ onToggleMobile }: HeaderProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.profile) setProfile(d.profile);
    }).catch(() => {});
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=10');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setNotifications([]);
    setUnreadCount(0);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Gerente',
    operator: 'Operador',
    viewer: 'Visualizador',
  };

  const typeIcon: Record<string, string> = {
    device_offline: '🔴',
    device_online: '🟢',
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <button onClick={onToggleMobile} className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative mr-3">
        <button onClick={() => { setShowNotifications(!showNotifications); setShowMenu(false); }}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white rounded-xl shadow-lg border border-gray-200 max-h-[70vh] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800">Marcar lidas</button>
                )}
              </div>
              <div className="overflow-y-auto max-h-[50vh]">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma notificação</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.read ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg mt-0.5">{typeIcon[n.type] || '📢'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          {n.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
          )}
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium text-gray-900 leading-tight">{profile?.full_name || 'Carregando...'}</div>
            <div className="text-[11px] text-gray-500">{roleLabel[profile?.role || ''] || profile?.role || ''}</div>
          </div>
          <svg className="w-4 h-4 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">{profile?.full_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{roleLabel[profile?.role || ''] || profile?.role}</div>
              </div>
              <button onClick={() => { setShowMenu(false); router.push('/settings'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                <span>👤</span> Meu Perfil
              </button>
              <hr className="my-1 border-gray-100" />
              <button onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                <span>🚪</span> Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
