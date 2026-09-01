'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  org_id: string;
  org_name: string;
  org_slug: string;
}

export default function PendingApprovalsPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const res = await fetch('/api/admin/pending-approvals');
      const data = await res.json();
      if (data.error) { router.push('/login'); return; }
      setPending(data.data ?? []);
    } catch {}
    setLoading(false);
  }

  async function handleApprove(userId: string) {
    setProcessing(userId);
    await fetch('/api/admin/pending-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action: 'approve' }),
    });
    setProcessing(null);
    loadPending();
  }

  async function handleReject(userId: string) {
    if (!confirm('Tem certeza? Isso excluirá o usuário e a organização.')) return;
    setProcessing(userId);
    await fetch('/api/admin/pending-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action: 'reject' }),
    });
    setProcessing(null);
    loadPending();
  }

  function timeSince(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cadastros Pendentes</h1>
        <p className="text-sm text-gray-500">Aguarde aprovação de novas empresas e seus administradores</p>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center text-gray-500 border border-gray-200">
          <div className="text-4xl mb-3">✓</div>
          <p>Nenhum cadastro pendente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(user => (
            <div key={user.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 text-lg font-bold flex-shrink-0">
                  {user.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{user.full_name}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pendente</span>
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Empresa: <span className="font-medium text-gray-600">{user.org_name}</span>
                    <span className="mx-1.5">·</span>
                    slug: <span className="font-mono text-gray-600">{user.org_slug}</span>
                    <span className="mx-1.5">·</span>
                    {timeSince(user.created_at)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(user.id)} disabled={processing === user.id}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {processing === user.id ? '...' : 'Aprovar'}
                  </button>
                  <button onClick={() => handleReject(user.id)} disabled={processing === user.id}
                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors">
                    Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
