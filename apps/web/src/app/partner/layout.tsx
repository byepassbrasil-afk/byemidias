'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const partnerNav = [
  { name: 'Meus Dispositivos', href: '/partner', icon: '📺' },
  { name: 'Meus Slots', href: '/partner/playlists', icon: '🕐' },
  { name: 'Mídia', href: '/partner/media', icon: '🎬' },
];

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/partner/auth/logout', { method: 'POST' });
    router.push('/partner/login');
    router.refresh();
  }

  // Don't show layout on login page
  if (pathname === '/partner/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-800 border-r border-gray-700">
        <div className="flex h-16 items-center px-6 border-b border-gray-700">
          <span className="text-xl font-bold text-white">ByeMidias</span>
          <span className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-xs text-white">
            Parceiro
          </span>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {partnerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <span>🚪</span>
            Sair
          </button>
        </div>
      </aside>
      <div className="pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-700 bg-gray-800 px-6">
          <h2 className="text-sm text-gray-400">
            Gerencie seus dispositivos e mídia
          </h2>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
