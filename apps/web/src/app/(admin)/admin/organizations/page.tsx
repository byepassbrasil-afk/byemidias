'use client';

import { useEffect, useState } from 'react';
import type { Organization } from '@/lib/types';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    const res = await fetch('/api/admin/crud/organizations?order=created_at&asc=false');
    const json = await res.json();
    setOrgs(json.data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName(''); setSlug(''); setEditing(null); setShowForm(false);
  }

  function startEdit(org: Organization) {
    setEditing(org); setName(org.name); setSlug(org.slug); setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await fetch('/api/admin/crud/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, name, slug, updated_at: new Date().toISOString() }),
      });
    } else {
      await fetch('/api/admin/crud/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
    }
    resetForm();
    setSaving(false);
    loadOrgs();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/crud/organizations?id=${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    loadOrgs();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizações</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Nova Organização
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar Organização' : 'Nova Organização'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-50 p-6 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir esta organização?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Nenhuma organização encontrada.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{org.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{org.slug}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${org.status === 'active' ? 'bg-green-100 text-green-800' : org.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(org.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => startEdit(org)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Editar</button>
                    <button onClick={() => setDeleteId(org.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
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
