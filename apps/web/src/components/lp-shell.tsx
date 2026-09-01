'use client';

import { useState } from 'react';

interface LpShellProps {
  variant: 'generic' | 'org';
  org?: {
    name: string;
    tagline?: string | null;
    primary_color: string;
  };
  stats?: {
    total_devices?: number;
    visible_devices?: number;
    cities?: number;
  };
  mapEmbed?: React.ReactNode;
}

export default function LpShell({ variant, org, stats, mapEmbed }: LpShellProps) {
  const primary = org?.primary_color || '#3b82f6';
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      message: fd.get('message'),
      source: variant === 'org' ? org?.name : 'generic',
      organization_slug: variant === 'org' ? org?.name : undefined,
    };
    const r = await fetch('/api/lp/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      alert('✓ Mensagem enviada! Entraremos em contato.');
      e.currentTarget.reset();
      setShowForm(false);
    } else {
      alert('Erro ao enviar. Tente novamente.');
    }
  }

  const totalDevices = stats?.total_devices ?? 150;
  const visibleDevices = stats?.visible_devices ?? 0;
  const cities = stats?.cities ?? 12;
  const title = variant === 'org' && org ? org.name : 'ByeMidias';
  const tagline =
    variant === 'org' && org?.tagline
      ? org.tagline
      : 'A rede de terminais de anúncio mais inteligente do Brasil';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100">
      {/* Hero */}
      <header
        className="text-white py-20 px-4"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, #1e293b 100%)` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-3">ByeMidias Platform</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">{tagline}</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-block bg-white text-gray-900 font-bold rounded-full px-8 py-3 hover:bg-gray-100 transition-colors shadow-xl"
            style={{ color: primary }}
          >
            Solicite orçamento
          </button>
        </div>
      </header>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white rounded-2xl shadow-xl p-6">
          <StatCard label="Terminais Ativos" value={totalDevices} color={primary} />
          <StatCard label="Cidades" value={cities} color={primary} />
          <StatCard label="Em Exibição" value="2M+" color={primary} />
          <StatCard label="Uptime" value="99.9%" color={primary} />
        </div>
      </section>

      {/* Map */}
      {mapEmbed && (
        <section className="max-w-6xl mx-auto px-4 mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">📍 Onde estamos</h2>
          {mapEmbed}
          <p className="text-center text-sm text-gray-500 mt-3">
            {visibleDevices > 0
              ? `${visibleDevices} ${visibleDevices === 1 ? 'terminal exibido' : 'terminais exibidos'}`
              : 'Nossa rede de terminais pelo Brasil'}
          </p>
        </section>
      )}

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Recursos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '📡', title: 'Sincronização Real-Time', desc: 'Atualização instantânea em todos os terminais' },
            { icon: '📊', title: 'Relatórios Detalhados', desc: 'Métricas de exibição e performance por região' },
            { icon: '👥', title: 'Multi-parceiro', desc: 'Cada parceiro gerencia seus próprios terminais' },
            { icon: '🎯', title: 'Targeting Geo', desc: 'Anúncios certos, nos lugares certos' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section className="max-w-2xl mx-auto px-4 mt-16 mb-16">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fale Conosco</h2>
          <p className="text-sm text-gray-600 mb-6">
            Preencha o formulário e nossa equipe entra em contato em até 24h.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Nome *</label>
              <input name="name" required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Email *</label>
              <input name="email" type="email" required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">WhatsApp</label>
              <input name="phone"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Mensagem</label>
              <textarea name="message" rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <button type="submit"
              className="w-full text-white font-bold rounded-lg py-3 hover:opacity-90 transition-opacity"
              style={{ background: primary }}>
              Enviar mensagem
            </button>
          </form>
        </div>
      </section>

      <footer className="text-center text-xs text-gray-500 py-8 border-t border-gray-200">
        © ByeMidias • Todos os direitos reservados
      </footer>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
