'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function PartnerSlugLoginPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [slugValid, setSlugValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Validate slug exists
    fetch(`/api/partner/${slug}/auth/login`, { method: 'OPTIONS' }).catch(() => {});
    // Try to fetch org info via a lightweight check
    fetch(`/api/partner/${slug}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '__check__', password: '__check__' }),
    }).then(r => r.json()).then(d => {
      if (d.error === 'Organização não encontrada') {
        setSlugValid(false);
      } else {
        setSlugValid(true);
        setOrgName(slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      }
    }).catch(() => setSlugValid(true));
  }, [slug]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/partner/${slug}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        setLoading(false);
        return;
      }

      router.push(`/partner/${slug}`);
      router.refresh();
    } catch {
      setError('Erro de conexão');
      setLoading(false);
    }
  }

  if (slugValid === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Organização não encontrada</h1>
          <p className="text-sm text-gray-500">O link <span className="font-mono text-gray-400">/{slug}</span> não corresponde a nenhuma organização ativa.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ByeMidias</h1>
          <p className="text-sm text-gray-500 mt-1">Área do Parceiro</p>
          {orgName && (
            <div className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-gray-800 border border-gray-700 px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-gray-300">{orgName}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Usuário</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="seu_usuario" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="••••••••" />
            </div>

            {error && (
              <div className="rounded-xl bg-red-900/20 border border-red-800/50 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href={`/partner/${slug}/signup`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Criar conta de parceiro
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
