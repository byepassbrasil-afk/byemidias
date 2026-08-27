'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao processar');
        setLoading(false);
        return;
      }

      setResetUrl(data.reset_url || '');
      setSuccess(true);
    } catch {
      setError('Erro de conexão');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link enviado!</h1>
            <p className="text-sm text-gray-600">
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
          </div>

          {resetUrl && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">Link de recuperação:</p>
              <a href={resetUrl} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-blue-600 underline break-all hover:text-blue-800">
                {resetUrl}
              </a>
              <p className="text-xs text-yellow-700 mt-2">⚠ Expira em 1 hora. Em produção, este link seria enviado por email.</p>
            </div>
          )}

          <Link href="/login"
            className="block w-full text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Voltar ao login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Esqueceu a senha?</h1>
          <p className="text-sm text-gray-500 mt-1">Informe seu email para redefinir</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="seu@email.com" />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Lembrou a senha?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </main>
  );
}
