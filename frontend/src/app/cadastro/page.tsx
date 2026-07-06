'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { reportApiError } from '@/lib/report-api-error';
import BrandLogo from '@/components/BrandLogo';

type RegistrationTenant = {
  slug: string;
  name: string;
};

type RegisterStatus = {
  registrationOpen: boolean;
  registrationRequiresKey: boolean;
  tenants: RegistrationTenant[];
};

export default function CadastroPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RegisterStatus | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [registrationKey, setRegistrationKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<RegisterStatus>('/auth/register-status')
      .then((data) => {
        setStatus(data);
        if (data.tenants.length === 1) {
          setTenantSlug(data.tenants[0].slug);
        }
      })
      .catch(() => {
        setLoadErr(true);
        setStatus(null);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { email: string; name: string | null };
        tenant: { name: string };
      }>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || null,
        tenantSlug: tenantSlug || undefined,
        ...(status?.registrationRequiresKey ? { registrationKey } : {}),
      });
      setAuthToken(res.token);
      router.replace('/');
      router.refresh();
    } catch (err) {
      reportApiError(err, { title: 'Não foi possível criar a conta' });
    } finally {
      setLoading(false);
    }
  };

  const multipleTenants = (status?.tenants.length ?? 0) > 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md card p-8 shadow-lg">
        <div className="text-center mb-6">
          <BrandLogo variant="full" className="mb-2" />
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Criar conta</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastro para usar o sistema como <strong>membro</strong> da organização (não administrador).
          </p>
        </div>

        {loadErr ? (
          <p className="text-sm text-red-600 mb-4">
            Não foi possível carregar as regras de cadastro. Verifique a API e{' '}
            <code className="text-xs">NEXT_PUBLIC_API_ORIGIN</code>.
          </p>
        ) : null}

        {status && !status.registrationOpen ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 mb-4 space-y-2">
            <p>
              O cadastro público está <strong>desligado</strong> neste servidor.
            </p>
            <p>
              Peça a um <strong>administrador</strong> para criar o seu utilizador em <strong>Usuários</strong>, ou
              use o primeiro acesso ao servidor se ainda não existir ninguém.
            </p>
          </div>
        ) : null}

        {status?.registrationOpen ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {multipleTenants ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
                <select
                  className="input-field w-full"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required
                >
                  <option value="">Selecione a empresa</option>
                  {status.tenants.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : status.tenants[0] ? (
              <p className="text-sm text-gray-600">
                Organização: <strong>{status.tenants[0].name}</strong>
              </p>
            ) : null}

            {status.registrationRequiresKey ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave de convite</label>
                <input
                  type="password"
                  autoComplete="off"
                  className="input-field w-full"
                  value={registrationKey}
                  onChange={(e) => setRegistrationKey(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fornecida pelo administrador (REGISTRATION_KEY no servidor).
                </p>
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome (opcional)</label>
              <input type="text" className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
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
              <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres.</p>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Criando conta…' : 'Criar conta e entrar'}
            </button>
          </form>
        ) : null}

        {!status && !loadErr ? <p className="text-sm text-gray-500 text-center py-4">Carregando…</p> : null}

        <p className="text-center mt-6">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Já tenho conta — ir para login
          </Link>
        </p>
      </div>
    </div>
  );
}
