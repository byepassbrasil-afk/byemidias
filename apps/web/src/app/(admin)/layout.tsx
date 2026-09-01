'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
}

const ADMIN_SECTIONS = [
  {
    title: 'Gestão SaaS',
    icon: '⚙️',
    items: [
      { name: 'Dashboard', href: '/admin', icon: '📊' },
      { name: 'Organizações', href: '/admin/organizations', icon: '🏢' },
      { name: 'Usuários', href: '/admin/users', icon: '👥' },
      { name: 'Dispositivos', href: '/admin/devices', icon: '📺' },
      { name: 'Parceiros', href: '/admin/partners', icon: '🤝' },
      { name: 'Contratos', href: '/admin/contracts', icon: '📝' },
      { name: 'Storage (R2)', href: '/admin/storage', icon: '🗂️' },
    ],
  },
  {
    title: 'Financeiro',
    icon: '💰',
    items: [
      { name: 'Relatórios', href: '/admin/reports', icon: '📈' },
      { name: 'Faturas', href: '/admin/invoices', icon: '🧾' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/profile')
      .then(r => r.json())
      .then(d => {
        if (!d.profile || !['super_admin', 'admin', 'manager'].includes(d.profile.role)) {
          router.replace('/login');
          return;
        }
        setUser(d.profile);
        setLoading(false);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-950 border-r border-gray-800 transform transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">BM</div>
          <div>
            <div className="font-semibold text-sm">ByeMidias</div>
            <div className="text-xs text-blue-400">Painel SaaS</div>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">
              {(user?.full_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.full_name || 'Admin'}</div>
              <div className="text-xs text-purple-400">{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Gerente'}</div>
            </div>
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-4">
          {ADMIN_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span>{section.icon}</span> {section.title}
              </div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname === item.href + '/';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Back to main */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <span>⬅️</span>
              Voltar ao Dashboard
            </Link>
          </div>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            ☰
          </button>

          <div className="hidden lg:flex items-center gap-4 text-sm text-gray-400">
            <span>/</span>
            <span className="text-white">{pathname}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white"
            >
              Sair
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
