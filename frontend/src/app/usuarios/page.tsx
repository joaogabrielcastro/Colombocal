'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cog6ToothIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { NAV_PERMISSION_OPTIONS, type NavPermissionKey } from '@/lib/navigation';
import api from '@/lib/api';
import { ListScaffold } from '@/components/ui/list-scaffold';
import { TableListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { reportApiError } from '@/lib/report-api-error';

type TenantUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  navPermissions: string[] | null;
  createdAt: string;
};

export default function UsuariosPage() {
  const [me, setMe] = useState<{ id: number; role: string } | null | undefined>(undefined);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [erro, setErro] = useState('');
  const [userToDelete, setUserToDelete] = useState<TenantUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [permUser, setPermUser] = useState<TenantUser | null>(null);
  const [permKeys, setPermKeys] = useState<NavPermissionKey[]>([]);
  const [salvandoPerm, setSalvandoPerm] = useState(false);

  const allNavKeys = NAV_PERMISSION_OPTIONS.map((o) => o.key);

  const abrirPermissoes = (u: TenantUser) => {
    setPermUser(u);
    const keys =
      u.navPermissions && u.navPermissions.length > 0
        ? (u.navPermissions as NavPermissionKey[])
        : [...allNavKeys];
    setPermKeys(keys);
  };

  const togglePermKey = (key: NavPermissionKey) => {
    setPermKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const salvarPermissoes = async () => {
    if (!permUser) return;
    setSalvandoPerm(true);
    try {
      const navPermissions =
        permKeys.length === allNavKeys.length ? null : permKeys;
      await api.patch<TenantUser>(`/users/${permUser.id}/nav-permissions`, {
        navPermissions,
      });
      setPermUser(null);
      carregarUsuarios();
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível salvar as abas' });
    } finally {
      setSalvandoPerm(false);
    }
  };

  const carregarUsuarios = useCallback(() => {
    setLoadingUsers(true);
    api
      .get<TenantUser[]>('/users')
      .then(setUsers)
      .catch((e) => {
        reportApiError(e, { title: 'Usuários', onRetry: () => void carregarUsuarios() });
        setUsers([]);
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    api
      .get<{ user: { id: number; role: string } }>('/auth/me')
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (me?.role !== 'admin') return;
    carregarUsuarios();
  }, [me, carregarUsuarios]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post<TenantUser>('/users', {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || null,
        role,
      });
      setMostrarForm(false);
      setEmail('');
      setPassword('');
      setName('');
      setRole('member');
      carregarUsuarios();
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível criar o usuário' });
      setErro(err instanceof Error ? err.message : '');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!userToDelete) return;
    setDeletingId(userToDelete.id);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setUserToDelete(null);
      carregarUsuarios();
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível excluir o usuário' });
    } finally {
      setDeletingId(null);
    }
  };

  if (me === undefined) {
    return (
      <div className="p-6">
        <TableListSkeleton rows={4} cols={3} />
      </div>
    );
  }

  if (me === null || me.role !== 'admin') {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Usuários</h1>
        <p className="text-gray-600 text-sm">
          Apenas administradores podem cadastrar ou remover usuários do sistema. Peça a um admin da
          sua organização para criar o acesso ou alterar seu papel.
        </p>
      </div>
    );
  }

  return (
    <>
      <ListScaffold
        title="Usuários"
        subtitle={`${users.length} pessoa(s) com acesso ao sistema nesta organização`}
        actions={
          <button
            type="button"
            onClick={() => {
              setMostrarForm(true);
              setErro('');
            }}
            className="btn-primary"
          >
            <PlusIcon className="w-4 h-4" /> Novo usuário
          </button>
        }
        content={
          <div className="card overflow-hidden">
            {loadingUsers ? (
              <div className="p-4">
                <TableListSkeleton rows={6} cols={4} />
              </div>
            ) : users.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Nenhum usuário listado"
                  description="Cadastre colaboradores com e-mail e senha. Cada um entra pela mesma tela de login."
                />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Nome</th>
                    <th className="table-header">E-mail</th>
                    <th className="table-header">Papel</th>
                    <th className="table-header">Abas</th>
                    <th className="table-header w-28" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="table-cell">{u.name || '—'}</td>
                      <td className="table-cell">{u.email}</td>
                      <td className="table-cell capitalize">{u.role === 'admin' ? 'Admin' : 'Membro'}</td>
                      <td className="table-cell text-xs text-gray-600">
                        {u.role === 'admin'
                          ? 'Todas'
                          : u.navPermissions?.length
                            ? `${u.navPermissions.length} aba(s)`
                            : 'Todas (padrão)'}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-1">
                          {u.role === 'member' && (
                            <button
                              type="button"
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                              title="Configurar abas visíveis"
                              onClick={() => abrirPermissoes(u)}
                            >
                              <Cog6ToothIcon className="w-4 h-4" />
                            </button>
                          )}
                          {u.id !== me.id ? (
                            <button
                              type="button"
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Remover acesso"
                              onClick={() => setUserToDelete(u)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs px-2 py-2">Você</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        }
      />

      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo usuário</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  className="input-field w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input-field w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                <select
                  className="input-field w-full"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                >
                  <option value="member">Membro (acesso ao sistema)</option>
                  <option value="admin">Administrador (inclui esta tela)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={salvando} className="btn-primary flex-1">
                  {salvando ? 'Salvando…' : 'Cadastrar'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Abas visíveis</h2>
            <p className="text-sm text-gray-600 mb-4">
              {permUser.name || permUser.email} — marque o que esta pessoa pode acessar no menu.
            </p>
            <div className="space-y-4">
              {['Principal', 'Avançado', 'Relatórios', 'Sistema'].map((group) => {
                const opts = NAV_PERMISSION_OPTIONS.filter((o) => o.group === group);
                if (!opts.length) return null;
                return (
                  <div key={group}>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {opts.map((o) => (
                        <label
                          key={o.key}
                          className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={permKeys.includes(o.key)}
                            onChange={() => togglePermKey(o.key)}
                            className="rounded"
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Com todas marcadas, o membro vê o menu completo (exceto Usuários, só admin).
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                disabled={salvandoPerm || permKeys.length === 0}
                className="btn-primary flex-1"
                onClick={() => void salvarPermissoes()}
              >
                {salvandoPerm ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPermUser(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!userToDelete}
        title="Remover usuário"
        description={
          userToDelete
            ? `Remover o acesso de ${userToDelete.email}? Ele não poderá mais entrar.`
            : undefined
        }
        confirmText="Remover"
        tone="danger"
        busy={deletingId != null}
        onCancel={() => setUserToDelete(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </>
  );
}
