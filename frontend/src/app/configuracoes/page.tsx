'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AUTH_SESSION_EVENT, getAuthToken } from '@/lib/auth-token';
import api from '@/lib/api';
import {
  clearTenantFeaturesCache,
  fetchTenantFeatures,
} from '@/hooks/useTenantFeatures';
import { filterConfigNav } from '@/lib/navigation';

type MeUser = {
  role: string;
  navPermissions?: string[] | null;
};

type TenantFeaturesConfig = {
  clienteCpf: boolean;
  frete: boolean;
};

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [features, setFeatures] = useState<TenantFeaturesConfig | null>(null);
  const [salvandoFeatures, setSalvandoFeatures] = useState(false);
  const [erroFeatures, setErroFeatures] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!getAuthToken()) {
        setMe(null);
        setFeatures(null);
        return;
      }
      api
        .get<{ user: MeUser }>('/auth/me')
        .then((r) => {
          if (!cancelled) setMe(r.user);
        })
        .catch(() => {
          if (!cancelled) setMe(null);
        });
    };
    load();
    window.addEventListener(AUTH_SESSION_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EVENT, load);
    };
  }, []);

  const isAdmin = me?.role === 'admin';

  const carregarFeatures = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get<TenantFeaturesConfig>('/config/tenant-features');
      setFeatures(data);
    } catch {
      setFeatures(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    void carregarFeatures();
  }, [carregarFeatures]);

  const freteEnabled = features?.frete ?? true;

  const items = filterConfigNav({
    isAdmin,
    navPermissions: me?.navPermissions ?? null,
    freteEnabled,
  });

  const salvarFeatures = async () => {
    if (!features) return;
    setSalvandoFeatures(true);
    setErroFeatures('');
    try {
      const next = await api.put<TenantFeaturesConfig>('/config/tenant-features', features);
      setFeatures(next);
      clearTenantFeaturesCache();
      await fetchTenantFeatures(true);
    } catch (e: unknown) {
      setErroFeatures(e instanceof Error ? e.message : 'Erro ao salvar módulos');
    } finally {
      setSalvandoFeatures(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      <p className="text-gray-500 text-sm mt-1 mb-6">
        Cadastros e ferramentas que você usa ocasionalmente — fora do fluxo diário de
        vender e receber.
      </p>

      {isAdmin ? (
        <section className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Módulos da organização</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ative ou desative funcionalidades para todos os usuários desta organização.
          </p>
          {erroFeatures ? (
            <p className="text-sm text-red-600 mb-3">{erroFeatures}</p>
          ) : null}
          {features ? (
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.clienteCpf}
                  onChange={(e) =>
                    setFeatures((f) => (f ? { ...f, clienteCpf: e.target.checked } : f))
                  }
                  className="w-4 h-4 rounded"
                />
                Permitir cadastro de clientes pessoa física (CPF)
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.frete}
                  onChange={(e) =>
                    setFeatures((f) => (f ? { ...f, frete: e.target.checked } : f))
                  }
                  className="w-4 h-4 rounded"
                />
                Habilitar módulo de frete nas vendas
              </label>
              <button
                type="button"
                className="btn-primary mt-2"
                disabled={salvandoFeatures}
                onClick={() => void salvarFeatures()}
              >
                {salvandoFeatures ? 'Salvando…' : 'Salvar módulos'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Carregando módulos…</p>
          )}
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma configuração disponível para o seu usuário.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card p-4 flex items-center gap-3 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Icon className="w-5 h-5" />
              </span>
              <span className="font-medium text-gray-900">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
