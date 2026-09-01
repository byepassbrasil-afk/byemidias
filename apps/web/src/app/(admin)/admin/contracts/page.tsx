'use client';

import Link from 'next/link';

export default function AdminContractsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contratos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crie modelos reutilizáveis e gere contratos personalizados para seus parceiros
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/contracts/templates"
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-2xl">
              📋
            </div>
            <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Modelos de Contrato</h2>
          <p className="text-sm text-gray-400">
            Crie templates reutilizáveis (ex: "Padrão 12 meses R$500", "Premium 24m R$1200")
          </p>
        </Link>

        <Link
          href="/admin/contracts/contracts"
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-2xl">
              📄
            </div>
            <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Contratos dos Parceiros</h2>
          <p className="text-sm text-gray-400">
            Gere, imprima, envie link público ou cancele contratos ativos
          </p>
        </Link>
      </div>
    </div>
  );
}
