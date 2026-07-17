'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { setTenantFeaturesCache } from '@/lib/tenant-features-cache';
import { reportApiError } from '@/lib/report-api-error';
import BrandLogo from '@/components/BrandLogo';

type LoginTenant = {
  slug: string;
  name: string;
};

type TenantsResponse = {
  tenants: LoginTenant[];
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenants, setTenants] = useState<LoginTenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<TenantsResponse>('/auth/tenants')
      .then((data) => {
        const list = data.tenants ?? [];
        setTenants(list);
        if (list.length === 1) {
          setTenantSlug(list[0].slug);
        }
      })
      .catch(() => {
        setTenants([]);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { email: string; name: string | null; tenantId: number };
        tenant: { id: number; name: string; slug?: string };
        features?: { clienteCpf?: boolean; frete?: boolean };
      }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
        ...(tenantSlug ? { tenantSlug } : {}),
      });
      setAuthToken(res.token);
      if (res.features) {
        setTenantFeaturesCache(
          {
            clienteCpf: !!res.features.clienteCpf,
            frete: !!res.features.frete,
          },
          res.user.tenantId ?? res.tenant.id,
        );
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.body as { code?: string; tenants?: LoginTenant[] } | undefined;
        if (body?.code === 'TENANT_REQUIRED' && Array.isArray(body.tenants) && body.tenants.length > 0) {
          setTenants(body.tenants);
          setTenantSlug('');
          reportApiError(err, { title: 'Selecione a organização' });
          return;
        }
      }
      reportApiError(err, { title: 'Falha no login' });
    } finally {
      setLoading(false);
    }
  };

  const multipleTenants = tenants.length > 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-8 shadow-lg">
        <div className="text-center mb-8">
          <BrandLogo variant="full" className="mb-1" />
          <p className="text-sm text-gray-500 mt-4">Entre com seu e-mail e senha</p>
        </div>
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
                {tenants.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : tenants[0] ? (
            <p className="text-sm text-gray-600 text-center">
              Organização: <strong>{tenants[0].name}</strong>
            </p>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="text-center mt-4">
          <Link href="/cadastro" className="text-sm font-medium text-blue-600 hover:underline">
            Criar conta para usar o sistema
          </Link>
        </p>
      </div>
    </div>
  );
}
