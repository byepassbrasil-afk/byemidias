'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string | null;
  org_name?: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [orgs, setOrgs] = useState<{id: string, name: string}[]>([]);

  useEffect(() => { loadUsers(); loadOrgs(); }, []);

  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/crud/users?limit=500');
      const data = await res.json();
      setUsers(data.data || []);
    } catch {}
    setLoading(false);
  }

  async function loadOrgs() {
    try {
      const res = await fetch('/api/admin/crud/organizations?limit=500');
      const d = await res.json();
      setOrgs(d.data || []);
    } catch {}
  }

  async function handleSave() {
    if (!editingUser) return;
    setSaving(true);
    await fetch('/api/admin/crud/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingUser.id, role: editingUser.role, organization_id: editingUser.organization_id || null,
      }),
    });
    setEditingUser(null);
    setSaving(false);
    loadUsers();
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-900/50 text-red-400',
    admin: 'bg-purple-900/50 text-purple-400',
    manager: 'bg-blue-900/50 text-blue-400',
    operator: 'bg-yellow-900/50 text-yellow-400',
    viewer: 'bg-gray-800 text-gray-400',
  };

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-sm text-gray-400">{users.length} usuários</p>
        </div>
        <input
          type="search"
          placeholder="Buscar usuário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-white w-64"
        />
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Perfil</th>
                <th className="text-left px-5 py-3">Organização</th>
                <th className="text-left px-5 py-3">Criado em</th>
                <th className="text-left px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">Nenhum usuário encontrado</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">{user.name}</td>
                  <td className="px-5 py-3 text-gray-400">{user.email}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${roleColors[user.role] || roleColors.viewer}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{user.org_name || user.organization_id || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setEditingUser(user)} className="text-blue-400 hover:text-blue-300 text-xs font-medium">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Editar Usuário — {editingUser.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Perfil</label>
                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Organização</label>
                <select value={editingUser.organization_id || ''} onChange={e => setEditingUser({ ...editingUser, organization_id: e.target.value || null })}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white">
                  <option value="">— Nenhuma —</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditingUser(null)} className="bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
