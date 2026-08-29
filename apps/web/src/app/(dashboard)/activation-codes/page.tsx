'use client';

import { useEffect, useState } from 'react';
import QrScannerModal from '../devices/QrScannerModal';

interface ActivationCode {
  id: string;
  code: string;
  status: string;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  used_at: string | null;
  organization_id: string | null;
  device?: { id: string; name: string; status: string } | null;
}

interface Org {
  id: string;
  name: string;
}

export default function ActivationCodesPage() {
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  useEffect(() => {
    loadCodes();
    loadOrgs();
  }, []);

  async function loadCodes() {
    try {
      const res = await fetch('/api/admin/activation-codes');
      const data = await res.json();
      setCodes(data.codes ?? []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function loadOrgs() {
    try {
      const res = await fetch('/api/admin/crud/organizations?order=name&asc=true');
      const data = await res.json();
      setOrgs(data.data ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerate() {
    if (!selectedOrg) {
      alert('Selecione uma organização');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/activation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, organization_id: selectedOrg }),
      });

      if (res.ok) {
        loadCodes();
      } else {
        const data = await res.json();
        alert('Erro: ' + data.error);
      }
    } catch {
      alert('Erro ao gerar códigos');
    }
    setGenerating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este código?')) return;
    try {
      const res = await fetch(`/api/admin/activation-codes?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadCodes();
    } catch {
      alert('Erro ao excluir');
    }
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">Disponível</span>;
      case 'used':
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">Utilizado</span>;
      case 'expired':
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">Expirado</span>;
      default:
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Códigos de Ativação</h1>
        <div className="flex items-center gap-3">
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Selecione a organização</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {[1, 5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n} código{n > 1 ? 's' : ''}</option>
            ))}
          </select>
          <button onClick={handleGenerate} disabled={generating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {generating ? 'Gerando...' : ' Gerar Códigos'}
          </button>
          <button onClick={() => setShowQrScanner(true)}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
            📱 Ler QR
          </button>
        </div>
      </div>

      {showQrScanner && (
        <QrScannerModal
          onClose={() => setShowQrScanner(false)}
          onScanned={(text) => {
            setShowQrScanner(false);
            navigator.clipboard.writeText(text).catch(() => {});
            alert(`UUID do dispositivo:\n${text}\n\nCopiado para a área de transferência.`);
          }}
        />
      )}

      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Como usar:</strong> Gere um código e compartilhe com o parceiro.
          No aplicativo Android, o parceiro inserirá este código para ativar o dispositivo.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Nenhum código gerado ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expira em</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-lg font-bold text-gray-900">{code.code}</span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(code.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {code.device ? code.device.name : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(code.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {code.expires_at ? new Date(code.expires_at).toLocaleDateString('pt-BR') : 'Sem expiração'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => copyCode(code.code, code.id)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
                        {copiedId === code.id ? '✓ Copiado' : '📋 Copiar'}
                      </button>
                      {code.status === 'pending' && (
                        <button onClick={() => handleDelete(code.id)}
                          className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200">
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
