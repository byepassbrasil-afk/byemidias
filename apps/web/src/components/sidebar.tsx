'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Dashboard',
    icon: '📊',
    items: [
      { name: 'Visão Geral', href: '/dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Conteúdo',
    icon: '🎬',
    items: [
      { name: 'Mídia', href: '/media', icon: '📁' },
      { name: 'Playlists', href: '/playlists', icon: '📋' },
      { name: 'Campanhas', href: '/campaigns', icon: '📢' },
      { name: 'Aprovações', href: '/approvals', icon: '✅' },
      { name: 'Diagramação', href: '/diagramacao', icon: '📐' },
    ],
  },
  {
    title: 'Monitoramento',
    icon: '📡',
    items: [
      { name: 'Dispositivos', href: '/devices', icon: '📺' },
      { name: 'Monitoramento', href: '/monitoring', icon: '📡' },
    ],
  },
  {
    title: 'Parceiros',
    icon: '🤝',
    items: [
      { name: 'Parceiros', href: '/partners', icon: '🤝' },
      { name: 'Códigos de Ativação', href: '/activation-codes', icon: '🔑' },
      { name: 'Uptime & Pagamento', href: '/uptime', icon: '💰' },
    ],
  },
  {
    title: 'Administração',
    icon: '⚙️',
    items: [
      { name: 'Organizações', href: '/organizations', icon: '🏢' },
      { name: 'Usuários', href: '/users', icon: '👥' },
      { name: 'Unidades', href: '/units', icon: '📍' },
      { name: 'Agendamento', href: '/schedules', icon: '📅' },
      { name: 'Programacao Semanal', href: '/campaign-schedule', icon: '🗓️' },
      { name: 'Grupos de Dispositivos', href: '/device-groups', icon: '📦' },
      { name: 'Configurações', href: '/settings', icon: '⚙️' },
    ],
  },
  {
    title: 'Relatórios',
    icon: '📈',
    items: [
      { name: 'Relatórios', href: '/reports', icon: '📊' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(sections.map(s => s.title))
  );

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900 text-white overflow-y-auto">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <span className="text-xl font-bold text-blue-400">ByeMidias</span>
        <span className="ml-2 text-xs text-gray-500">DOOH</span>
      </div>
      <nav className="py-3">
        {sections.map((section) => {
          const isOpen = openSections.has(section.title);
          const isActive = section.items.some(item => pathname === item.href);

          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className={clsx(
                  'w-full flex items-center gap-3 px-6 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'text-blue-400 bg-gray-800/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                )}
              >
                <span className="text-base">{section.icon}</span>
                <span className="flex-1 text-left">{section.title}</span>
                <svg
                  className={clsx(
                    'w-4 h-4 transition-transform',
                    isOpen && 'rotate-90'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {isOpen && (
                <div className="ml-4 border-l border-gray-700 pl-3 py-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 rounded-r-lg px-3 py-2 text-sm transition-colors',
                        pathname === item.href
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <span className="text-sm">{item.icon}</span>
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
