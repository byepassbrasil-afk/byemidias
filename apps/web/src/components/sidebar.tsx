'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  organization_id: string | null;
  org_name: string | null;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const sections: NavSection[] = [
  {
    title: 'Dashboard',
    icon: '📊',
    items: [{ name: 'Visão Geral', href: '/dashboard', icon: '📊' }],
  },
  {
    title: 'Conteúdo',
    icon: '🎬',
    items: [
      { name: 'Mídia', href: '/dashboard/media', icon: '📁' },
      { name: 'Playlists', href: '/dashboard/playlists', icon: '📋' },
      { name: 'Campanhas', href: '/dashboard/campaigns', icon: '📢' },
      { name: 'Aprovações', href: '/dashboard/approvals', icon: '✅' },
      { name: 'Mídia Parceiro', href: '/dashboard/approvals/media', icon: '🖼️' },
      { name: 'Diagramação', href: '/dashboard/diagramacao', icon: '📐' },
    ],
  },
  {
    title: 'Monitoramento',
    icon: '📡',
    items: [
      { name: 'Dispositivos', href: '/dashboard/devices', icon: '📺' },
      { name: 'Monitoramento', href: '/dashboard/monitoring', icon: '📡' },
    ],
  },
  {
    title: 'Parceiros',
    icon: '🤝',
    items: [
      { name: 'Parceiros', href: '/dashboard/partners', icon: '🤝' },
      { name: 'Códigos de Ativação', href: '/dashboard/devices/activation-codes', icon: '🔑' },
      { name: 'Uptime & Pagamento', href: '/dashboard/devices/uptime', icon: '💰' },
    ],
  },
  {
    title: 'Administração',
    icon: '⚙️',
    items: [
      { name: 'Unidades', href: '/dashboard/units', icon: '📍' },
      { name: 'Agendamento', href: '/dashboard/schedules', icon: '📅' },
      { name: 'Programação Semanal', href: '/dashboard/campaigns', icon: '🗓️' },
      { name: 'Grupos de Dispositivos', href: '/dashboard/device-groups', icon: '📦' },
      { name: 'Configurações', href: '/dashboard/settings', icon: '⚙️' },
    ],
  },
  {
    title: 'Financeiro',
    icon: '💰',
    items: [
      { name: 'Receitas', href: '/dashboard/financeiro/revenues', icon: '📈' },
      { name: 'Despesas', href: '/dashboard/financeiro/expenses', icon: '📉' },
      { name: 'Faturas', href: '/dashboard/invoices', icon: '🧾' },
      { name: 'Tarifas', href: '/dashboard/partner-payments', icon: '💰' },
    ],
  },
  {
    title: 'Relatórios',
    icon: '📈',
    items: [{ name: 'Relatórios', href: '/dashboard/reports', icon: '📊' }],
  },
  {
    title: 'Contratos',
    icon: '📝',
    items: [
      { name: 'Contratos', href: '/dashboard/contracts', icon: '📄' },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(sections.map(s => s.title))
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        setProfile(d.profile);
        if (d.profile.role === 'super_admin' || d.profile.role === 'admin') {
          fetch('/api/admin/pending-approvals').then(r => r.json()).then(pd => {
            setPendingCount(pd.data?.length || 0);
          }).catch(() => {});
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const activeSection = sections.find(s => s.items.some(i => pathname.startsWith(i.href)));
    if (activeSection) {
      setOpenSections(prev => new Set([...prev, activeSection.title]));
    }
  }, [pathname]);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleLinkClick = () => {
    if (mobileOpen) onCloseMobile();
  };

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  const filteredSections = sections.filter(s => {
    if (s.adminOnly && !isAdmin) return false;
    return true;
  }).map(s => ({
    ...s,
    items: s.items.filter(i => {
      if (i.adminOnly && !isAdmin) return false;
      return true;
    }),
  }));

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center px-4 border-b border-gray-800">
        <span className="text-lg font-bold text-blue-400">ByeMidias</span>
        <span className="ml-1.5 text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">DOOH</span>
      </div>

      {isAdmin && (
        <Link href="/saas" onClick={handleLinkClick}
          className={clsx(
            'mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/saas') ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/40'
          )}>
          <span>🏢</span>
          <span>Painel SAAS</span>
        </Link>
      )}

      {isSuperAdmin && (
        <Link href="/admin" onClick={handleLinkClick}
          className={clsx(
            'mx-3 mb-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/admin') ? 'bg-red-600 text-white' : 'bg-red-900/30 text-red-300 hover:bg-red-800/40'
          )}>
          <span>🛡️</span>
          <span>Painel Admin</span>
        </Link>
      )}

      <nav className="flex-1 py-2 overflow-y-auto">
        {filteredSections.map((section) => {
          const isOpen = openSections.has(section.title);
          const isActive = section.items.some(item => pathname.startsWith(item.href));

          return (
            <div key={section.title} className="mb-0.5">
              <button
                onClick={() => toggleSection(section.title)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-blue-400 bg-gray-800/50' : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                )}
              >
                <span className="text-sm w-5 text-center">{section.icon}</span>
                <span className="flex-1 text-left">{section.title}</span>
                <svg className={clsx('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {isOpen && (
                <div className="ml-3 border-l border-gray-700 pl-2 py-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className={clsx(
                        'flex items-center gap-2 rounded-r-md px-2.5 py-1.5 text-sm transition-colors',
                        pathname.startsWith(item.href)
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <span className="text-xs">{item.icon}</span>
                      {item.name}
                      {item.href === '/pending-approvals' && pendingCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {profile && (
        <Link href="/settings" onClick={handleLinkClick}
          className="border-t border-gray-800 p-3 hover:bg-gray-800/50 transition-colors flex items-center gap-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{profile.full_name}</div>
            <div className="text-[11px] text-gray-500 truncate">{profile.org_name || 'Sem organização'}</div>
          </div>
        </Link>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-60 bg-gray-900 text-white flex-col">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={onCloseMobile} />
          <aside className="fixed left-0 top-0 z-50 h-full w-72 bg-gray-900 text-white lg:hidden transform transition-transform">
            <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-400">ByeMidias</span>
                <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">DOOH</span>
              </div>
              <button onClick={onCloseMobile} className="text-gray-400 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
