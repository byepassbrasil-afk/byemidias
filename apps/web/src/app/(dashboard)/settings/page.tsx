'use client';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Geral</h2>
          <p className="text-sm text-gray-500 mt-1">Configurações gerais da plataforma.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Plataforma</label>
            <input
              defaultValue="ByeMidias"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL do Player APK</label>
            <input
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de Heartbeat (segundos)</label>
          <input
            type="number"
            defaultValue={30}
            className="w-48 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeout Offline (minutos)</label>
          <input
            type="number"
            defaultValue={2}
            className="w-48 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          />
        </div>

        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Salvar
        </button>
      </div>
    </div>
  );
}
