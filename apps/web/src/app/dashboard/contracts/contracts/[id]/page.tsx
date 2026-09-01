'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Contract {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_username: string;
  partner_email: string | null;
  organization_id: string;
  organization_name: string;
  template_id: string | null;
  template_name: string | null;
  start_date: string;
  end_date: string | null;
  duration_months: number;
  monthly_fee: number;
  hourly_fee: number;
  bonus_structure: any;
  custom_clauses: string | null;
  contract_pdf_url: string | null;
  contract_url_token: string | null;
  signing_method: string | null;
  signed_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/partner-contracts?partner_id=`);
      const d = await r.json();
      const found = (d.contracts ?? []).find((c: Contract) => c.id === id);
      setContract(found || null);
      if (found?.contract_url_token) {
        setPublicUrl(`${window.location.origin}/contract-view/${found.contract_url_token}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setMessage('✓ Link copiado!');
    setTimeout(() => setMessage(null), 2000);
  }

  async function regenerateLink() {
    setMessage('Gerando novo link...');
    const r = await fetch(`/api/admin/partner-contracts/${id}/generate-link`, { method: 'POST' });
    const d = await r.json();
    if (d.token) {
      setPublicUrl(`${window.location.origin}/contract-view/${d.token}`);
      await load();
      setMessage('✓ Novo link gerado!');
      setTimeout(() => setMessage(null), 2000);
    }
  }

  async function markSigned() {
    if (!confirm('Marcar como assinado manualmente?')) return;
    await fetch(`/api/admin/partner-contracts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signing_method: 'manual', signed_at: new Date().toISOString() }),
    });
    await load();
  }

  async function cancel() {
    if (!confirm('Cancelar este contrato?')) return;
    await fetch(`/api/admin/partner-contracts/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Carregando...</div>;
  }

  if (!contract) {
    return (
      <div>
        <Link href="/admin/contracts/contracts" className="text-sm text-gray-400 hover:text-white">← Contratos</Link>
        <div className="mt-6 text-gray-400">Contrato não encontrado.</div>
      </div>
    );
  }

  const endDate = contract.end_date ? new Date(contract.end_date) : null;
  const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <div>
      <Link href="/admin/contracts/contracts" className="text-sm text-gray-400 hover:text-white">← Contratos</Link>

      {message && (
        <div className="mt-3 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-sm text-green-300">
          {message}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Contrato</p>
                <p className="font-mono text-gray-400 text-sm">#{contract.id.slice(0, 8)}</p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                contract.status === 'active' ? 'bg-green-900/40 text-green-300' :
                contract.status === 'expired' ? 'bg-yellow-900/40 text-yellow-300' :
                contract.status === 'cancelled' ? 'bg-red-900/40 text-red-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {contract.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Contratante</p>
                <p className="text-white font-medium">{contract.organization_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Contratado</p>
                <p className="text-white font-medium">{contract.partner_name}</p>
                <p className="text-xs text-gray-500">@{contract.partner_username}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
              <div>
                <p className="text-xs text-gray-500 mb-1">Início</p>
                <p className="text-white">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Término</p>
                <p className="text-white">
                  {contract.end_date ? new Date(contract.end_date).toLocaleDateString('pt-BR') : 'Sem prazo'}
                </p>
                {daysLeft !== null && (
                  <p className={`text-xs ${daysLeft <= 30 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Expirado'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Duração</p>
                <p className="text-white">{contract.duration_months} {contract.duration_months === 1 ? 'mês' : 'meses'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mensalidade</p>
                <p className="text-2xl font-bold text-white">R$ {Number(contract.monthly_fee).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Por hora</p>
                <p className="text-2xl font-bold text-white">R$ {Number(contract.hourly_fee).toFixed(2)}</p>
              </div>
            </div>

            {contract.bonus_structure && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Bonificação</p>
                {contract.bonus_structure.type === 'tier' && Array.isArray(contract.bonus_structure.tiers) && (
                  <ul className="space-y-1">
                    {contract.bonus_structure.tiers.map((t: any, i: number) => (
                      <li key={i} className="text-sm text-green-300">
                        ≥ {t.min_hours}h/mês: + R$ {Number(t.bonus_amount).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
                {contract.bonus_structure.type === 'fixed' && (
                  <p className="text-sm text-green-300">
                    ≥ {contract.bonus_structure.monthly_target_hours}h/mês: + R$ {Number(contract.bonus_structure.monthly_bonus_amount).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {contract.custom_clauses && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Cláusulas Adicionais</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{contract.custom_clauses}</p>
              </div>
            )}

            {contract.notes && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Notas internas</p>
                <p className="text-sm text-gray-400 italic">{contract.notes}</p>
              </div>
            )}

            {contract.signed_at && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-green-400">✓ Assinado em {new Date(contract.signed_at).toLocaleString('pt-BR')}</p>
                {contract.signing_method && (
                  <p className="text-xs text-gray-500">Método: {contract.signing_method}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {contract.contract_pdf_url && (
            <a href={contract.contract_pdf_url} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors">
              📄 Baixar PDF do Contrato
            </a>
          )}

          {publicUrl && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-2">Link público (sem login)</p>
              <div className="flex gap-2">
                <input readOnly value={publicUrl}
                  className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-300 font-mono" />
                <button onClick={copyLink}
                  className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-500">
                  Copiar
                </button>
              </div>
              <button onClick={regenerateLink}
                className="mt-2 w-full text-xs text-gray-400 hover:text-white">
                ↻ Gerar novo link (invalida o anterior)
              </button>
            </div>
          )}

          {contract.status === 'active' && !contract.signed_at && (
            <button onClick={markSigned}
              className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3 transition-colors">
              ✅ Marcar como Assinado
            </button>
          )}

          {contract.status === 'active' && (
            <button onClick={cancel}
              className="w-full rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-300 font-semibold py-3 transition-colors">
              ❌ Cancelar Contrato
            </button>
          )}

          <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-4 text-xs text-gray-500 space-y-1">
            <p><span className="text-gray-400">Template:</span> {contract.template_name || 'Customizado'}</p>
            <p><span className="text-gray-400">Criado em:</span> {new Date(contract.created_at).toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
