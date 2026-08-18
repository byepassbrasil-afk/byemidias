'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Aprovações', href: '/approvals', icon: '✅' },
  { name: 'Organizações', href: '/organizations', icon: '🏢' },
  { name: 'Usuários', href: '/users', icon: '👥' },
  { name: 'Unidades', href: '/units', icon: '📍' },
  { name: 'Dispositivos', href: '/devices', icon: '📺' },
  { name: 'Mídia', href: '/media', icon: '🎬' },
  { name: 'Playlists', href: '/playlists', icon: '📋' },
  { name: 'Campanhas', href: '/campaigns', icon: '📢' },
  { name: 'Parceiros', href: '/partners', icon: '🤝' },
  { name: 'Códigos de Ativação', href: '/activation-codes', icon: '🔑' },
  { name: 'Monitoramento', href: '/monitoring', icon: '📡' },
  { name: 'Configurações', href: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900 text-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <span className="text-xl font-bold">ByeMidias</span>
      </div>
      <nav className="mt-4 space-y-1 px-3">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
