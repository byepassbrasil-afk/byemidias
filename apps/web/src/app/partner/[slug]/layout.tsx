'use client';

import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PartnerInfo {
  username: string;
  displayName: string;
  organizationId: string;
  slug: string;
}

export default function PartnerSlugLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.partner) {
        setPartner({ ...d.partner, slug });
      } else {
        router.push(`/partner/${slug}/login`);
      }
    }).catch(() => router.push(`/partner/${slug}/login`)).finally(() => setLoading(false));
  }, [slug, router]);

  async function handleLogout() {
    await fetch(`/api/partner/${slug}/auth/logout`, { method: 'POST' });
    router.push(`/partner/${slug}/login`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) return null;

  const nav = [
    { label: 'Dashboard', href: `/partner/${slug}`, icon: '📊' },
    { label: 'Mídia', href: `/partner/${slug}/media`, icon: '📁' },
    { label: 'Playlists', href: `/partner/${slug}/playlists`, icon: '📋' },
  ];

  const initials = partner.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-gray-400 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Link href={`/partner/${slug}`} className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-400">ByeMidias</span>
              <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Parceiro</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{partner.displayName}</div>
                <div className="text-[10px] text-gray-500">{slug}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop nav */}
        <aside className="hidden lg:block w-56 min-h-[calc(100vh-56px)] border-r border-gray-800 bg-gray-900/50 p-3">
          <nav className="space-y-1">
            {nav.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                  pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile nav overlay */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed left-0 top-14 z-50 w-64 h-[calc(100vh-56px)] bg-gray-900 border-r border-gray-800 p-3 lg:hidden">
              <nav className="space-y-1">
                {nav.map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </aside>
          </>
        )}

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  );
}
