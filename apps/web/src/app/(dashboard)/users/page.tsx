'use client';

import { useEffect, useState } from 'react';
import type { Profile, UserRole } from '@/lib/types';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const res = await fetch('/api/admin/crud/profiles?order=created_at&asc=false');
    const json = await res.json();
    setUsers(json.data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName(''); setEmail(''); setPassword(''); setRole('viewer'); setEditing(null); setShowForm(false);
  }

  function startEdit(user: Profile) {
    setEditing(user); setRole(user.role); setShowForm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: name, role }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert('Erro: ' + result.error);
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    loadUsers();
  }

  async function handleUpdateRole() {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/admin/crud/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, role, updated_at: new Date().toISOString() }),
    });
    setEditing(null); setSaving(false); loadUsers();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/crud/profiles?id=${deleteId}`, { method: 'DELETE' });
    setDeleteId(null); loadUsers();
  }

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Novo Usuário
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Criar Novo Usuário</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {editing && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Editar Função — {editing.full_name}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleUpdateRole} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="mb-6 rounded-xl bg-red-50 p-6 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza que deseja excluir este usuário?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhum usuário encontrado.</p></div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Função</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name || 'Sem nome'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                      {roleLabels[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Editar</button>
                    <button onClick={() => setDeleteId(user.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
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
