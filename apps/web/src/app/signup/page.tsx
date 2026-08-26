'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ temp_password: string; org_name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function handleCompanyChange(value: string) {
    setCompanyName(value);
    if (!slugEdited) {
      setCompanySlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setCompanySlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          company_name: companyName,
          company_slug: companySlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        setLoading(false);
        return;
      }
      setSuccessData({ temp_password: data.temp_password, org_name: data.organization.name });
    } catch {
      setError('Erro de conexão');
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Conta criada com sucesso!</h1>
            <p className="text-sm text-gray-600">Empresa: <strong>{successData.org_name}</strong></p>
          </div>

          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">Sua senha temporária:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white rounded px-3 py-2 text-sm font-mono text-gray-900 border border-yellow-300">
                {successData.temp_password}
              </code>
              <button onClick={() => navigator.clipboard.writeText(successData.temp_password)}
                className="bg-yellow-200 hover:bg-yellow-300 px-3 py-2 rounded text-sm font-medium whitespace-nowrap">
                Copiar
              </button>
            </div>
            <p className="text-xs text-yellow-700 mt-2">
              ⚠ Anote esta senha. Ao fazer login pela primeira vez, você será solicitado a criar uma nova senha.
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Email:</strong> {email}<br />
              <strong>Acesse:</strong> <Link href="/login" className="underline">byemidias.com/login</Link>
            </p>
          </div>

          <Link href="/login"
            className="block w-full text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ByeMidias</h1>
          <p className="text-sm text-gray-500">Cadastre sua empresa</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa *</label>
            <input type="text" value={companyName} onChange={e => handleCompanyChange(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ex: DOOH-X" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL da empresa) *</label>
            <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <span className="pl-3 text-sm text-gray-400">byemidias.com/</span>
              <input type="text" value={companySlug} onChange={e => handleSlugChange(e.target.value)} required
                className="w-full rounded-r-lg border-0 px-1 py-2.5 text-sm outline-none bg-transparent"
                placeholder="doohx" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Apenas letras, números e hífens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="João Silva" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="seu@email.com" />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Criando...' : 'Criar conta da empresa'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
