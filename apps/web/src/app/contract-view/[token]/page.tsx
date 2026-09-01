'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ContractData {
  id: string;
  organization_name: string;
  organization_id: string;
  partner_name: string;
  partner_username: string;
  partner_email: string | null;
  start_date: string;
  end_date: string | null;
  duration_months: number;
  monthly_fee: number;
  hourly_fee: number;
  bonus_structure: any | null;
  custom_clauses: string | null;
  contract_pdf_url: string | null;
  status: string;
  signed_at: string | null;
  created_at: string;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('pt-BR');
}

export default function ContractViewPage() {
  const params = useParams();
  const token = params.token as string;
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contract-view/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContract(data.contract);
      })
      .catch(() => setError('Erro de conexão'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando contrato…</p>
      </main>
    );
  }

  if (error || !contract) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Contrato não encontrado</h1>
          <p className="text-gray-500">{error || 'Link inválido ou expirado.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <header className="bg-gradient-to-br from-blue-900 to-blue-700 text-white px-8 py-10 text-center">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Contrato de Parceria</p>
          <h1 className="text-3xl font-bold mb-1">{contract.organization_name}</h1>
          <p className="text-sm opacity-80">CNPJ/ID: {contract.organization_id.slice(0, 8)}…</p>
        </header>

        <section className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Partes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Contratante</p>
              <p className="font-bold text-gray-900">{contract.organization_name}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-xs text-purple-600 uppercase tracking-wider mb-1">Contratado</p>
              <p className="font-bold text-gray-900">{contract.partner_name}</p>
              <p className="text-xs text-gray-500">@{contract.partner_username}</p>
            </div>
          </div>
        </section>

        <section className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Vigência</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Início</p>
              <p className="font-semibold text-gray-900">{fmtDate(contract.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Término</p>
              <p className="font-semibold text-gray-900">
                {contract.end_date ? fmtDate(contract.end_date) : 'Sem prazo'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Duração</p>
              <p className="font-semibold text-gray-900">{contract.duration_months} {contract.duration_months === 1 ? 'mês' : 'meses'}</p>
            </div>
          </div>
        </section>

        <section className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Valores</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Mensalidade</p>
              <p className="text-2xl font-bold text-gray-900">R$ {Number(contract.monthly_fee).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Por hora</p>
              <p className="text-2xl font-bold text-gray-900">R$ {Number(contract.hourly_fee).toFixed(2)}</p>
            </div>
          </div>
        </section>

        {contract.bonus_structure && (
          <section className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Bonificações</h2>
            {contract.bonus_structure.type === 'tier' && Array.isArray(contract.bonus_structure.tiers) && (
              <ul className="space-y-2">
                {contract.bonus_structure.tiers.map((t: any, i: number) => (
                  <li key={i} className="flex items-center gap-3 bg-green-50 rounded-lg p-3">
                    <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">
                      ≥{t.min_hours}h
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">Atingir ≥ <strong>{t.min_hours} horas/mês</strong></p>
                      <p className="text-sm text-green-700 font-bold">+ R$ {Number(t.bonus_amount).toFixed(2)} de bônus</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {contract.bonus_structure.type === 'fixed' && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-900">
                  Atingir <strong>{contract.bonus_structure.monthly_target_hours} horas/mês</strong>
                </p>
                <p className="text-2xl font-bold text-green-700 mt-2">
                  + R$ {Number(contract.bonus_structure.monthly_bonus_amount).toFixed(2)} de bônus
                </p>
              </div>
            )}
          </section>
        )}

        {contract.custom_clauses && (
          <section className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Cláusulas Adicionais</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.custom_clauses}</p>
          </section>
        )}

        <section className="px-8 py-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex rounded-full px-4 py-1 text-xs font-bold ${
              contract.status === 'active' ? 'bg-green-100 text-green-700' :
              contract.status === 'expired' ? 'bg-yellow-100 text-yellow-700' :
              contract.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {contract.status.toUpperCase()}
            </span>
            {contract.signed_at && (
              <p className="text-xs text-gray-500">Assinado em: {fmtDate(contract.signed_at)}</p>
            )}
          </div>

          {contract.contract_pdf_url && (
            <a
              href={contract.contract_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              📄 Baixar Contrato em PDF
            </a>
          )}
        </section>

        <footer className="px-8 py-4 bg-gray-900 text-gray-500 text-xs text-center">
          Contrato gerado eletronicamente em {new Date(contract.created_at).toLocaleString('pt-BR')} • ByeMidias
        </footer>
      </article>
    </main>
  );
}
