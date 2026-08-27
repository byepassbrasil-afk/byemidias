'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao redefinir senha');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro de conexão');
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Token inválido</h1>
          <p className="text-sm text-gray-600 mb-4">O link de redefinição de senha é inválido.</p>
          <Link href="/forgot-password"
            className="block w-full text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Solicitar novo link
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Senha redefinida!</h1>
          <p className="text-sm text-gray-600 mb-4">Agora faça login com sua nova senha.</p>
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
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Redefinir Senha</h1>
          <p className="text-sm text-gray-500 mt-1">Crie uma nova senha para sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Repita a senha" />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Salvando...' : 'Redefinir Senha'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Carregando...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
