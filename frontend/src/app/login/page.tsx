'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BuildingOffice2Icon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenants, setTenants] = useState<LoginTenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTenantsLoading(true);
    api
      .get<TenantsResponse>('/auth/tenants')
      .then((data) => {
        if (cancelled) return;
        const list = data.tenants ?? [];
        setTenants(list);
        setTenantsError(false);
        if (list.length === 1) {
          setTenantSlug(list[0].slug);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTenants([]);
        setTenantsError(true);
      })
      .finally(() => {
        if (!cancelled) setTenantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tenants.length > 1 && !tenantSlug) {
      reportApiError(new Error('Selecione a organização'), {
        title: 'Organização obrigatória',
      });
      return;
    }
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
      // Navegação completa: zera estado React/Next do tenant anterior (evita lista errada)
      window.location.assign('/');
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
  const selectedTenant = tenants.find((t) => t.slug === tenantSlug) ?? null;
  const canSubmit =
    !loading &&
    !tenantsLoading &&
    email.trim().length > 0 &&
    password.length > 0 &&
    (!multipleTenants || !!tenantSlug);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, #CDEBFA 0%, transparent 55%), linear-gradient(180deg, #f3f6f9 0%, #f9fafb 45%, #eef2f6 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <div className="card p-7 sm:p-8 shadow-lg border-gray-200/80">
          <div className="text-center mb-7">
            <BrandLogo variant="full" className="mb-1" />
            <h1 className="sr-only">Entrar</h1>
            <p className="text-sm text-gray-500 mt-4">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organização
              </label>
              {tenantsLoading ? (
                <div className="grid grid-cols-1 gap-2">
                  <div className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                </div>
              ) : tenantsError ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  Não foi possível carregar as organizações. Você ainda pode tentar entrar; se
                  o e-mail existir em mais de uma, pediremos a empresa.
                </p>
              ) : multipleTenants ? (
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Organização">
                  {tenants.map((t) => {
                    const selected = tenantSlug === t.slug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTenantSlug(t.slug)}
                        className={`flex items-center gap-3 w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/30'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                            selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <BuildingOffice2Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate">
                            {t.name}
                          </span>
                          <span className="block text-xs text-gray-500 truncate">{t.slug}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : tenants[0] ? (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <BuildingOffice2Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {tenants[0].name}
                    </span>
                    <span className="block text-xs text-gray-500">{tenants[0].slug}</span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhuma organização disponível no momento.</p>
              )}
            </div>

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="input-field"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-field pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5 justify-center" disabled={!canSubmit}>
              {loading
                ? 'Entrando…'
                : selectedTenant
                  ? `Entrar em ${selectedTenant.name}`
                  : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link href="/cadastro" className="text-sm font-medium text-blue-600 hover:underline">
              Criar conta para usar o sistema
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
