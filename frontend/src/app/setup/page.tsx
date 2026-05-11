'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { reportApiError } from '@/lib/report-api-error';

type SetupStatus = {
  setupEnabled: boolean;
  needsBootstrap: boolean;
  databaseReady: boolean;
  migrateOnStart: boolean;
};

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [tenantName, setTenantName] = useState('Minha organização');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<SetupStatus>('/setup/status')
      .then(setStatus)
      .catch(() => {
        setStatusError(true);
        setStatus(null);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { email: string };
        tenant: { name: string };
      }>('/setup/first-admin', {
        setupSecret,
        tenantName: tenantName.trim() || 'Minha organização',
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || null,
      });
      setAuthToken(res.token);
      router.replace('/');
      router.refresh();
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível concluir o primeiro acesso' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md card p-8 shadow-lg">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 bg-blue-600 rounded-xl items-center justify-center text-white font-bold text-lg mb-3">
            C
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Primeiro acesso</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crie o administrador sem usar o terminal (apenas enquanto não existir nenhum usuário).
          </p>
        </div>

        {statusError ? (
          <p className="text-sm text-red-600 mb-4">
            Não foi possível falar com a API. Confira <code className="text-xs">NEXT_PUBLIC_API_ORIGIN</code> e se o
            backend está no ar.
          </p>
        ) : null}

        {status && !status.setupEnabled ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 mb-4">
            No servidor, defina <strong>SETUP_SECRET</strong> (mínimo 8 caracteres), salve o deploy e
            recarregue esta página. Depois do primeiro admin criado, remova o segredo do ambiente.
          </div>
        ) : null}

        {status && status.setupEnabled && !status.databaseReady ? (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm p-4 mb-4">
            O banco não está pronto (sem tabelas ou indisponível). No Coolify ative{' '}
            <strong>RUN_PRISMA_MIGRATE_ON_START=true</strong> no backend para aplicar migrações ao subir o
            container, ou rode <code className="text-xs">prisma migrate deploy</code> uma vez.{' '}
            {status.migrateOnStart ? ' Esta instância já está com migrate-on-start ligado; verifique os logs do deploy.' : ''}
          </div>
        ) : null}

        {status && status.setupEnabled && status.databaseReady && !status.needsBootstrap ? (
          <div className="rounded-lg bg-gray-100 border border-gray-200 text-gray-800 text-sm p-4 mb-4">
            Já existe usuário no sistema. Use a{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              tela de login
            </Link>
            .
          </div>
        ) : null}

        {status && status.setupEnabled && status.databaseReady && status.needsBootstrap ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chave de setup</label>
              <input
                type="password"
                autoComplete="off"
                className="input-field w-full"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                placeholder="A mesma definida em SETUP_SECRET no servidor"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Definida só no servidor (Coolify), não no código.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da organização</label>
              <input
                type="text"
                className="input-field w-full"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome (opcional)</label>
              <input type="text" className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do administrador</label>
              <input
                type="email"
                autoComplete="email"
                className="input-field w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                autoComplete="new-password"
                className="input-field w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Criando…' : 'Criar administrador e entrar'}
            </button>
          </form>
        ) : null}

        {!status && !statusError ? (
          <p className="text-sm text-gray-500 text-center py-4">Carregando…</p>
        ) : null}

        <p className="text-center mt-6">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Ir para login
          </Link>
        </p>
      </div>
    </div>
  );
}
