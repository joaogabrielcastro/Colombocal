'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import api, { ApiError } from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { setTenantFeaturesCache } from '@/lib/tenant-features-cache';
import { reportApiError } from '@/lib/report-api-error';
import { nextPathFromSearch } from '@/lib/safe-next-path';
import BrandLogo from '@/components/BrandLogo';

type TenantOption = { slug: string; name: string };

function tenantsFromError(err: ApiError): TenantOption[] {
  const body = err.body;
  if (!body || typeof body !== 'object') return [];
  const tenants = (body as { tenants?: unknown }).tenants;
  if (!Array.isArray(tenants)) return [];
  return tenants.filter(
    (t): t is TenantOption =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as TenantOption).slug === 'string' &&
      typeof (t as TenantOption).name === 'string',
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantSlug, setTenantSlug] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { email: string; name: string | null; tenantId: number };
        tenant: { id: number; name: string; slug?: string };
        features?: { clienteCpf?: boolean; frete?: boolean; fretePagoDefault?: boolean };
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
            fretePagoDefault: !!res.features.fretePagoDefault,
          },
          res.user.tenantId ?? res.tenant.id,
        );
      }
      const next = nextPathFromSearch(window.location.search);
      window.location.assign(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const list = tenantsFromError(err);
        if (list.length) {
          setTenants(list);
          setTenantSlug((prev) => prev || list[0].slug);
          return;
        }
      }
      reportApiError(err, { title: 'Falha no login' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <BrandLogo variant="full" className="mb-2" />
            <h1 className="sr-only">Entrar</h1>
            <p className="text-gray-500 text-sm mt-4">Entre com seu e-mail e senha</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
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
                className="block text-sm font-medium text-gray-700 mb-1"
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

            {tenants.length > 0 && (
              <div>
                <label
                  htmlFor="login-tenant"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Organização
                </label>
                <select
                  id="login-tenant"
                  className="input-field"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required
                >
                  {tenants.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Este e-mail existe em mais de uma organização. Escolha onde deseja entrar.
                </p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/cadastro" className="text-blue-600 hover:underline">
              Criar conta para usar o sistema
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
