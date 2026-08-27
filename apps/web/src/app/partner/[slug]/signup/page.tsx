'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function PartnerSlugSignupPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    setOrgName(slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }, [slug]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) { setError('As senhas não coincidem'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/partner/${slug}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao criar conta'); setLoading(false); return; }
      setSuccess(true);
    } catch { setError('Erro de conexão'); setLoading(false); }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Conta criada!</h1>
          <p className="text-sm text-gray-500 mb-6">Sua conta de parceiro foi criada com sucesso.</p>
          <button onClick={() => router.push(`/partner/${slug}/login`)}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            Fazer login
          </button>
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
          <h1 className="text-2xl font-bold text-white">Criar Conta</h1>
          {orgName && (
            <div className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-gray-800 border border-gray-700 px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-gray-300">{orgName}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome de exibição</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="Ex: Minha Empresa" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Usuário</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="seu_usuario" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                placeholder="Repita a senha" />
            </div>

            {error && <div className="rounded-xl bg-red-900/20 border border-red-800/50 p-3 text-sm text-red-400">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20">
              {loading ? 'Criando...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href={`/partner/${slug}/login`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Já tem conta? Fazer login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
