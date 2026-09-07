'use client';

import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  is_default: boolean;
  is_global: boolean;
}

interface AssignedCategory {
  category_id: string;
  is_blocked: boolean;
  name: string;
  icon: string;
  color: string;
  is_global: boolean;
}

interface CategoriesSectionProps {
  deviceId: string;
}

export default function CategoriesSection({ deviceId }: CategoriesSectionProps) {
  const [assigned, setAssigned] = useState<AssignedCategory[]>([]);
  const [available, setAvailable] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/dashboard/devices/${deviceId}/categories`);
      const d = await r.json();
      setAssigned(d.assigned ?? []);
      setAvailable(d.available ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [deviceId]);

  async function save(updates: { category_id: string; is_blocked: boolean }[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/devices/${deviceId}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Erro ao salvar');
        setSaving(false);
        return;
      }
      setMessage('✓ Categorias atualizadas!');
      setTimeout(() => setMessage(null), 3000);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
    setSaving(false);
  }

  function allow(c: Category) {
    const next = [...assigned.filter(a => a.category_id !== c.id), { category_id: c.id, is_blocked: false, name: c.name, icon: c.icon, color: c.color, is_global: c.is_global }];
    save(next.map(a => ({ category_id: a.category_id, is_blocked: a.is_blocked })));
  }
  function block(c: Category) {
    const next = [...assigned.filter(a => a.category_id !== c.id), { category_id: c.id, is_blocked: true, name: c.name, icon: c.icon, color: c.color, is_global: c.is_global }];
    save(next.map(a => ({ category_id: a.category_id, is_blocked: a.is_blocked })));
  }
  function remove(c: Category) {
    const next = assigned.filter(a => a.category_id !== c.id);
    save(next.map(a => ({ category_id: a.category_id, is_blocked: a.is_blocked })));
  }

  const allowed = assigned.filter(a => !a.is_blocked);
  const blocked = assigned.filter(a => a.is_blocked);

  return (
    <section className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">🏷️ Categorias do Dispositivo</h2>
          <p className="text-xs text-gray-500 mt-1">
            Define quais mídias podem tocar neste device. Use <strong>permitir</strong> ou <strong>bloquear</strong> para concorrentes.
          </p>
        </div>
        {saving && <span className="text-xs text-orange-400">Salvando...</span>}
      </div>

      {message && (
        <div className="mb-3 rounded-lg bg-green-900/30 border border-green-700/50 p-2 text-sm text-green-300">{message}</div>
      )}
      {error && (
        <div className="mb-3 rounded-lg bg-red-900/30 border border-red-700/50 p-2 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : (
        <>
          {assigned.length === 0 && (
            <div className="mb-3 text-xs text-gray-500 bg-blue-900/20 border border-blue-700/30 rounded p-2">
              💡 Modo permissivo: sem categorias configuradas, o dispositivo mostra todas as mídias.
            </div>
          )}

          {/* Permitidas */}
          <div className="mb-4">
            <div className="text-xs text-green-400 font-medium mb-2 flex items-center gap-2">
              ✓ Permitidas ({allowed.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {allowed.map((c) => (
                <CategoryChip key={c.category_id} c={c} variant="allowed" onRemove={() => remove(c)} onBlock={() => block(c)} />
              ))}
              {allowed.length === 0 && (
                <span className="text-xs text-gray-500 italic">Nenhuma categoria permitida configurada</span>
              )}
            </div>
          </div>

          {/* Bloqueadas */}
          <div className="mb-4">
            <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-2">
              ✕ Bloqueadas ({blocked.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {blocked.map((c) => (
                <CategoryChip key={c.category_id} c={c} variant="blocked" onRemove={() => remove(c)} onAllow={() => allow(c)} />
              ))}
              {blocked.length === 0 && (
                <span className="text-xs text-gray-500 italic">Nenhuma categoria bloqueada</span>
              )}
            </div>
          </div>

          {/* Adicionar nova */}
          {available.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-orange-400 hover:text-orange-300 font-medium">
                + Adicionar categoria ({available.length} disponíveis)
              </summary>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {available.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                    <span
                      className="w-8 h-8 rounded flex items-center justify-center text-base"
                      style={{ backgroundColor: c.color + '30', border: `1px solid ${c.color}` }}
                    >
                      {c.icon}
                    </span>
                    <span className="text-xs text-white flex-1 truncate">{c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => allow(c)} className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white" title="Permitir">✓</button>
                      <button onClick={() => block(c)} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white" title="Bloquear">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function CategoryChip({ c, variant, onRemove, onAllow, onBlock }: {
  c: { category_id?: string; id?: string; name: string; icon: string; color: string; is_global: boolean };
  variant: 'allowed' | 'blocked';
  onRemove: () => void;
  onAllow?: () => void;
  onBlock?: () => void;
}) {
  const bg = variant === 'allowed' ? 'bg-green-900/30 border-green-700/50' : 'bg-red-900/30 border-red-700/50';
  const color = variant === 'allowed' ? '#10b981' : '#ef4444';
  const icon = variant === 'allowed' ? '✓' : '✕';

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 ${bg}`}>
      <span
        className="w-7 h-7 rounded flex items-center justify-center text-base"
        style={{ backgroundColor: c.color + '30', border: `1px solid ${c.color}` }}
      >
        {c.icon}
      </span>
      <span className="text-sm text-white">{c.name}</span>
      {c.is_global && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">🌍</span>}
      <button onClick={onRemove} className="text-gray-400 hover:text-white text-sm" title="Remover">×</button>
      {variant === 'allowed' && onBlock && (
        <button onClick={onBlock} className="text-xs text-gray-400 hover:text-red-400" title="Bloquear">🚫</button>
      )}
      {variant === 'blocked' && onAllow && (
        <button onClick={onAllow} className="text-xs text-gray-400 hover:text-green-400" title="Permitir">✓</button>
      )}
    </div>
  );
}
