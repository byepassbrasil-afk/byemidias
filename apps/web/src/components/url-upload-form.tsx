'use client';

import { useState } from 'react';

interface UrlUploadFormProps {
  onClose: () => void;
  onSaved: () => void;
  organizationId: string;
  preTtlDays: number;
  setPreTtlDays: (v: number) => void;
  preDisplayName: string;
  setPreDisplayName: (v: string) => void;
  preOrientation: string;
  setPreOrientation: (v: string) => void;
  preReason: string;
  setPreReason: (v: string) => void;
  preShowReason: boolean;
  setPreShowReason: (v: boolean) => void;
  availableCats: Array<{ id: string; name: string; icon: string; color: string; is_default: boolean; is_global: boolean }>;
  preCategoryIds: Set<string>;
  setPreCategoryIds: (v: Set<string>) => void;
  preExcludedCatIds: Set<string>;
  setPreExcludedCatIds: (v: Set<string>) => void;
  preExcludedOrgIds: Set<string>;
  setPreExcludedOrgIds: (v: Set<string>) => void;
  preExcludedDeviceIds: Set<string>;
  setPreExcludedDeviceIds: (v: Set<string>) => void;
  availableDevices: Array<{ id: string; name: string; org_name?: string; status: string }>;
  preDeviceSearch: string;
  setPreDeviceSearch: (v: string) => void;
}

export default function UrlUploadForm(props: UrlUploadFormProps) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSet(s: Set<string>, v: string): Set<string> {
    const next = new Set(s);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }

  async function handleSave() {
    setError(null);
    if (!/^https?:\/\/[^\s]+/i.test(url)) {
      setError('URL inválida. Use http:// ou https://');
      return;
    }
    if (!props.organizationId) {
      setError('Selecione uma organização primeiro.');
      return;
    }
    if (props.preTtlDays === 0 && props.preReason.trim().length < 10) {
      setError('Para "Manter para sempre" é necessário justificar com pelo menos 10 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crud/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: undefined, // not needed for create
          organization_id: props.organizationId,
          file_url: url,
          file_name: props.preDisplayName || url,
          display_name: props.preDisplayName || url,
          media_type: 'url',
          default_orientation: props.preOrientation,
          ttl_days: props.preTtlDays,
          expires_reason: props.preTtlDays === 0 ? props.preReason : undefined,
          category_ids: Array.from(props.preCategoryIds),
          excluded_category_ids: Array.from(props.preExcludedCatIds),
          excluded_organization_ids: Array.from(props.preExcludedOrgIds),
          excluded_device_ids: Array.from(props.preExcludedDeviceIds),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Erro ${res.status}`);
        setSaving(false);
        return;
      }
      props.onSaved();
    } catch (e: any) {
      setError('Erro: ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">🌐 URL da página</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://exemplo.com/pagina"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          URL pública (http/https). O dispositivo vai abrir essa página em tela cheia, sem scroll/clique.
        </p>
      </div>

      {url && /^https?:\/\/[^\s]+/i.test(url) && (
        <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 px-3 py-1.5 border-b border-gray-200 bg-white">Preview (somente visualização)</div>
          <iframe src={url} title="preview" className="w-full h-64 bg-white pointer-events-none" />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome de exibição</label>
        <input value={props.preDisplayName} onChange={e => props.setPreDisplayName(e.target.value)}
          placeholder="Ex: Cardápio Digital"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Validade (dias)</label>
          <select value={props.preTtlDays} onChange={e => props.setPreTtlDays(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 outline-none">
            <option value={1}>1 dia</option>
            <option value={7}>7 dias (padrão)</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={0}>Para sempre (requer justificativa)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Orientação</label>
          <select value={props.preOrientation} onChange={e => props.setPreOrientation(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 outline-none">
            <option value="auto">Automática</option>
            <option value="portrait">Vertical (em pé)</option>
            <option value="landscape">Horizontal</option>
          </select>
        </div>
      </div>

      {props.preTtlDays === 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (mínimo 10 caracteres) *</label>
          <textarea value={props.preReason} onChange={e => props.setPreReason(e.target.value)}
            rows={2}
            placeholder="Justificativa para manter para sempre..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
      )}

      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🏷️ Categorias e restrições (opcional)</summary>
        <div className="p-4 space-y-4 border-t border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Categorias permitidas</label>
            <div className="flex flex-wrap gap-2">
              {props.availableCats.map(c => {
                const selected = props.preCategoryIds.has(c.id);
                return (
                  <button key={c.id} type="button"
                    onClick={() => props.setPreCategoryIds(toggleSet(props.preCategoryIds, c.id))}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={selected ? { backgroundColor: c.color } : undefined}>
                    <span>{c.icon}</span> {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Categorias bloqueadas (excluir)</label>
            <div className="flex flex-wrap gap-2">
              {props.availableCats.map(c => {
                const selected = props.preExcludedCatIds.has(c.id);
                return (
                  <button key={c.id} type="button"
                    onClick={() => props.setPreExcludedCatIds(toggleSet(props.preExcludedCatIds, c.id))}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all ${selected ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    <span>{c.icon}</span> {c.name}
                    {selected && <span>✕</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={props.onClose} disabled={saving}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving || !url}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Salvando...' : '💾 Salvar URL'}
        </button>
      </div>
    </div>
  );
}
