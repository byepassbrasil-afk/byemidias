'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
  is_default: boolean;
  is_global?: boolean;
  media_count?: number;
  device_count?: number;
}

export default function DashboardCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState('#ee6a1e');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ICON_OPTIONS = ['🏷️', '🏪', '🛒', '🍔', '🍕', '☕', '⛽', '🚗', '👕', '👟', '💊', '🏥', '🎬', '📺', '📱', '💻', '🏠', '🏨', '🏋️', '🎓', '💼', '🏦', '🎮', '🎨'];

  const COLOR_OPTIONS = ['#ee6a1e', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard/categories');
      const text = await r.text();
      const d = text ? JSON.parse(text) : {};
      if (!r.ok) throw new Error(d.error || 'Erro ao listar categorias');
      setCategories(d.categories ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const localCategories = categories.filter(c => !c.is_global);
  const globalCategories = categories.filter(c => c.is_global);

  function openCreate() {
    setEditing(null);
    setName('');
    setSlug('');
    setIcon('🏷️');
    setColor('#ee6a1e');
    setDescription('');
    setError(null);
    setMessage(null);
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setIcon(c.icon);
    setColor(c.color);
    setDescription(c.description || '');
    setError(null);
    setMessage(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = { name, slug, icon, color, description };
      const url = editing ? `/api/dashboard/categories/${editing.id}` : '/api/dashboard/categories';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Erro ao salvar');
        setSaving(false);
        return;
      }
      setShowModal(false);
      setMessage(editing ? '✓ Categoria atualizada!' : '✓ Categoria criada!');
      setTimeout(() => setMessage(null), 3000);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      setError(msg);
    }
    setSaving(false);
  }

  async function handleDelete(c: Category) {
    if (c.is_default) {
      alert('Categoria "Padrão" não pode ser excluída.');
      return;
    }
    if (!confirm(`Excluir a categoria "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/dashboard/categories/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Erro ao excluir: ' + (err.error || res.statusText));
      return;
    }
    setMessage('✓ Categoria excluída!');
    setTimeout(() => setMessage(null), 3000);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as categorias dos seus dispositivos e mídias</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nova Categoria
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{message}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">Carregando...</div>
      ) : (
        <>
          {/* Local Categories */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              🏢 Suas Categorias
              <span className="text-xs font-normal text-gray-500">({localCategories.length})</span>
            </h2>
            {localCategories.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                Nenhuma categoria local. Crie a primeira!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localCategories.map((c) => (
                  <CategoryCard key={c.id} c={c} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>

          {/* Global Categories (read-only) */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              🌍 Globais
              <span className="text-xs font-normal text-gray-500">({globalCategories.length} — somente leitura)</span>
            </h2>
            {globalCategories.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                Nenhuma categoria global. Super admin pode criar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {globalCategories.map((c) => (
                  <CategoryCard key={c.id} c={c} readOnly />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal de criar/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editing) {
                        const auto = e.target.value.toLowerCase()
                          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '');
                        setSlug(auto);
                      }
                    }}
                    required
                    placeholder="Ex: Mercado, Padaria, Shopping"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="mercado"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Gerado automaticamente a partir do nome. Você pode editar.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ícone</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setIcon(e)}
                        className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${icon === e ? 'bg-orange-100 ring-2 ring-orange-500 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Descrição opcional..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50 rounded-b-2xl">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50">
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({ c, onEdit, onDelete, readOnly }: {
  c: Category;
  onEdit?: (c: Category) => void;
  onDelete?: (c: Category) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: c.color + '20', border: `2px solid ${c.color}` }}
          >
            {c.icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {c.name}
              {c.is_default && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Padrão</span>
              )}
              {c.is_global && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🌍 Global</span>
              )}
            </h3>
            <p className="text-xs text-gray-500 font-mono">{c.slug}</p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            {onEdit && (
              <button onClick={() => onEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Editar">
                ✏️
              </button>
            )}
            {onDelete && !c.is_default && (
              <button onClick={() => onDelete(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
      {c.description && (
        <p className="text-sm text-gray-600 mb-3">{c.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>📁 {c.media_count ?? 0} mídias</span>
        <span>📺 {c.device_count ?? 0} dispositivos</span>
      </div>
    </div>
  );
}
