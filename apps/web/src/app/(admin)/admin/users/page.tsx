'use client';

import { useEffect, useState } from 'react';
import type { Profile, UserRole } from '@/lib/types';

interface CurrentUser {
  id: string;
  role: UserRole;
  organization_id: string | null;
  org_name: string | null;
  org_slug: string | null;
}

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

const ROLE_HIERARCHY = ['super_admin', 'admin', 'manager', 'operator', 'viewer'] as const;
type Role = (typeof ROLE_HIERARCHY)[number];

const ROLE_LEVEL: Record<Role, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

// Roles que cada um pode criar/definir: igual ou inferior, nunca super_admin
function manageableRoles(actorRole: string): Role[] {
  if (!isRole(actorRole)) return [];
  if (actorRole === 'super_admin') return []; // super_admin não cria via essa rota
  return ROLE_HIERARCHY.filter(r => r !== 'super_admin' && ROLE_LEVEL[actorRole] > ROLE_LEVEL[r]);
}

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLE_HIERARCHY as readonly string[]).includes(v);
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [inviteResult, setInviteResult] = useState<{ url: string; name: string; org: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [targetOrgId, setTargetOrgId] = useState<string>(''); // só usado se super_admin

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/profile').then(r => r.json()),
      fetch('/api/admin/crud/organizations?order=name&asc=true').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([profileRes, orgsRes]) => {
      if (profileRes.profile) {
        setCurrentUser({
          id: profileRes.profile.id,
          role: profileRes.profile.role,
          organization_id: profileRes.profile.organization_id,
          org_name: profileRes.profile.org_name,
          org_slug: profileRes.profile.org_slug,
        });
        // default: org do admin logado
        if (profileRes.profile.organization_id) {
          setTargetOrgId(profileRes.profile.organization_id);
        }
      }
      setOrgs((orgsRes.data ?? []) as OrgOption[]);
    });
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch('/api/admin/crud/profiles?order=created_at&asc=false');
    const json = await res.json();
    setUsers(json.data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName(''); setEmail(''); setRole('viewer');
    setTargetOrgId(currentUser?.organization_id ?? '');
    setEditing(null); setShowForm(false); setInviteResult(null); setError(null);
  }

  function startEdit(user: Profile) {
    setEditing(user); setRole(user.role); setShowForm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // super_admin sem org definida no form nem própria: erro
    if (currentUser?.role === 'super_admin' && !targetOrgId) {
      setError('Selecione uma organização para o novo usuário.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      email,
      full_name: name,
      role,
      send_invite: true,
    };
    if (currentUser?.role === 'super_admin' && targetOrgId) {
      payload.organization_id = targetOrgId;
    }

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error || 'Erro ao criar usuário');
      setSaving(false);
      return;
    }
    setInviteResult({
      url: result.invite_url,
      name,
      org: result.organization?.name ?? '—',
    });
    setSaving(false);
    loadUsers();
  }

  async function handleUpdateRole() {
    if (!editing) return;
    setError(null);
    setSaving(true);
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: editing.id, role }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error || 'Erro ao atualizar função');
      setSaving(false);
      return;
    }
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

  const availableRoles = currentUser ? manageableRoles(currentUser.role) : [];
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const currentOrg = currentUser?.org_name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Usuários</h1>
          {currentUser && (
            <p className="text-xs text-gray-500 mt-1">
              Sua organização: <span className="font-medium text-gray-700">{currentOrg}</span>
              {!isSuperAdmin && (
                <span className="ml-2 text-gray-400">• novos usuários são adicionados a ela automaticamente</span>
              )}
            </p>
          )}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Novo
        </button>
      </div>

      {inviteResult && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-sm font-medium text-green-800">
              Usuário <strong>{inviteResult.name}</strong> criado na organização <strong>{inviteResult.org}</strong>!
            </span>
          </div>
          <div>
            <label className="block text-xs text-green-700 mb-1">Link de convite (expira em 7 dias):</label>
            <div className="flex gap-2">
              <input readOnly value={inviteResult.url} className="flex-1 rounded-lg border border-green-300 px-3 py-2 text-sm bg-white font-mono" />
              <button onClick={() => navigator.clipboard.writeText(inviteResult.url)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                Copiar
              </button>
            </div>
            <p className="text-xs text-green-600 mt-1">Envie este link ao usuário. Ele definirá a senha ao acessar.</p>
          </div>
          <button onClick={resetForm} className="text-sm text-green-700 hover:text-green-900 font-medium">Fechar</button>
        </div>
      )}

      {showForm && !editing && !inviteResult && (
        <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 sm:p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Criar Novo Usuário</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" required
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            <select value={role} onChange={e => setRole(e.target.value as UserRole)} required
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
              {availableRoles.map(r => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>

            {/* Select de org: super_admin escolhe, demais veem a org fixa */}
            {isSuperAdmin ? (
              <select value={targetOrgId} onChange={e => setTargetOrgId(e.target.value)} required
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="">— Selecione a organização —</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-700 flex items-center">
                <span className="text-gray-500 mr-2">🏢</span>
                <span className="font-medium">{currentOrg}</span>
                <span className="ml-auto text-xs text-gray-400">fixa</span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          <p className="text-xs text-gray-500">
            {isSuperAdmin
              ? 'Como super_admin, você pode adicionar o usuário em qualquer organização.'
              : 'O novo usuário será vinculado à sua organização atual. Ele receberá um link de convite por email.'}
            <br />
            <span className="text-gray-400">Hierarquia: super_admin → admin → manager → operator → viewer. Você só pode criar funções iguais ou inferiores à sua, e nunca super_admin.</span>
          </p>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar + Gerar Convite'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      )}

      {editing && (
        <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Editar — {editing.full_name}</h3>
          <p className="text-xs text-gray-500">
            Você pode atribuir apenas funções iguais ou inferiores à sua ({currentUser?.role}).
            <br />
            <span className="text-gray-400">Hierarquia: super_admin → admin → manager → operator → viewer</span>
          </p>
          {editing.id === currentUser?.id ? (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              Você não pode alterar o seu próprio role.
            </div>
          ) : (
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
              {availableRoles.map(r => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          )}
          {error && editing.id !== currentUser?.id && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-2">
            <button onClick={handleUpdateRole} disabled={saving || editing.id === currentUser?.id} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => { setEditing(null); setError(null); }} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancelar</button>
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
          {users.map(user => {
            // Filtra visualmente: mostra org se for diferente do admin logado
            const otherOrg = isSuperAdmin && user.organization_id !== currentUser?.organization_id;
            return (
              <div key={user.id} className="rounded-xl bg-white p-4 shadow-sm border border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                  {user.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.full_name || 'Sem nome'}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email || ''}
                    {otherOrg && (
                      <span className="ml-2 inline-flex items-center gap-1 text-indigo-600">
                        🏢 {((user as unknown) as Record<string, unknown>).org_name as string ?? 'outra org'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                    {roleLabels[user.role] ?? user.role}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    user.status === 'active' ? 'bg-green-100 text-green-700' :
                    user.status === 'pending_invite' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {user.status === 'pending_invite' ? 'Aguardando convite' : user.status}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(user)}
                    disabled={user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? 'Você não pode editar seu próprio role' : 'Editar função'}
                    className="text-blue-600 hover:text-blue-800 text-xs p-1.5 disabled:opacity-30 disabled:cursor-not-allowed">
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(user.id)}
                    disabled={user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? 'Você não pode excluir a si mesmo' : 'Excluir usuário'}
                    className="text-red-600 hover:text-red-800 text-xs p-1.5 disabled:opacity-30 disabled:cursor-not-allowed">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
