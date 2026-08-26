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
    if (!res.ok) { alert('Erro: ' + result.error); setSaving(false); return; }
    resetForm(); setSaving(false); loadUsers();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Usuários</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Novo
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 sm:p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Criar Novo Usuário</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" required
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required minLength={6}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Gerente</option>
              <option value="operator">Operador</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {editing && (
        <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Editar — {editing.full_name}</h3>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="manager">Gerente</option>
            <option value="operator">Operador</option>
            <option value="viewer">Visualizador</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleUpdateRole} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-800 mb-3">Tem certeza?</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
            <button onClick={() => setDeleteId(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center text-gray-500">Nenhum usuário</div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="rounded-xl bg-white p-4 shadow-sm border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                {user.full_name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{user.full_name || 'Sem nome'}</div>
                <div className="text-xs text-gray-500 truncate">{user.phone || user.email || ''}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                  {roleLabels[user.role] ?? user.role}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {user.status}
                </span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800 text-xs p-1.5">✏️</button>
                <button onClick={() => setDeleteId(user.id)} className="text-red-600 hover:text-red-800 text-xs p-1.5">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
