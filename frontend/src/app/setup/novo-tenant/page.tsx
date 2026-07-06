'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { reportApiError } from '@/lib/report-api-error';
import BrandLogo from '@/components/BrandLogo';

type SetupStatus = {
  setupEnabled: boolean;
  needsBootstrap: boolean;
  databaseReady: boolean;
};

export default function NovoTenantPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
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
        token?: string;
        user: { email: string };
        tenant: { name: string; slug: string | null };
      }>('/setup/tenant', {
        setupSecret,
        tenantName: tenantName.trim(),
        tenantSlug: tenantSlug.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || null,
      });
      if (res.token) {
        setAuthToken(res.token);
        router.replace('/');
        router.refresh();
      } else {
        router.replace('/login');
      }
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível criar a organização' });
    } finally {
      setLoading(false);
    }
  };

  const canCreate =
    status?.setupEnabled && status.databaseReady && !status.needsBootstrap;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md card p-8 shadow-lg">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <BrandLogo variant="full" priority className="max-h-20" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nova organização</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cria um tenant isolado no mesmo banco, com administrador próprio. Requer a chave de setup do
            servidor.
          </p>
        </div>

        {statusError ? (
          <p className="text-sm text-red-600 mb-4">
            Não foi possível falar com a API. Confira se o backend está no ar.
          </p>
        ) : null}

        {status && !status.setupEnabled ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 mb-4">
            Defina <strong>SETUP_SECRET</strong> no servidor (mínimo 8 caracteres) para habilitar esta
            operação.
          </div>
        ) : null}

        {status && status.needsBootstrap ? (
          <div className="rounded-lg bg-gray-100 border border-gray-200 text-gray-800 text-sm p-4 mb-4">
            Ainda não há usuários. Use a{' '}
            <Link href="/setup" className="text-blue-600 font-medium hover:underline">
              tela de primeiro acesso
            </Link>
            .
          </div>
        ) : null}

        {canCreate ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chave de setup</label>
              <input
                type="password"
                autoComplete="off"
                className="input-field w-full"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                required
              />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identificador (slug, opcional)
              </label>
              <input
                type="text"
                className="input-field w-full"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="ex.: distribuidora-sul"
                pattern="[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?"
              />
              <p className="text-xs text-gray-500 mt-1">Letras minúsculas, números e hífens. Não use &quot;default&quot;.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do administrador (opcional)</label>
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
              <p className="text-xs text-gray-500 mt-1">Deve ser diferente dos e-mails já cadastrados.</p>
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
              {loading ? 'Criando…' : 'Criar organização e entrar'}
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
