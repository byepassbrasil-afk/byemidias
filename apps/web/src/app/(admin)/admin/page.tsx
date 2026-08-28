'use client';

import Link from 'next/link';

export default function AdminIndexPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Super Admin</h1>
        <p className="text-gray-400">Painel administrativo exclusivo — ByeMidias</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/admin/saas', label: 'SaaS', desc: 'Visão geral da plataforma', icon: '📊' },
          { href: '/admin/organizations', label: 'Organizações', desc: 'Todas as orgs cadastradas', icon: '🏢' },
          { href: '/admin/users', label: 'Usuários', desc: 'Gerenciar usuários', icon: '👥' },
          { href: '/admin/devices', label: 'Dispositivos', desc: 'Todos os dispositivos', icon: '📺' },
          { href: '/admin/partners', label: 'Parceiros', desc: 'Acesso parceiro', icon: '🤝' },
          { href: '/admin/reports', label: 'Relatórios', desc: 'Relatórios gerados', icon: '📈' },
          { href: '/admin/invoices', label: 'Faturas', desc: 'Faturas da plataforma', icon: '🧾' },
          { href: '/admin/settings', label: 'Configurações', desc: 'Ajustes globais', icon: '⚙️' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group">
            <span className="text-3xl mb-3 block">{item.icon}</span>
            <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">{item.label}</h3>
            <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-purple-900/20 border border-purple-800/30 rounded-xl p-5">
        <h3 className="text-purple-300 font-semibold mb-2">⚡ Acesso Super Admin</h3>
        <p className="text-gray-400 text-sm">
          Este painel é restrito a super_admin. Todas as ações são registradas.
          Acesse via conta <span className="text-white font-mono text-xs">gwmorata@gmail.com</span>.
        </p>
      </div>
    </div>
  );
}
