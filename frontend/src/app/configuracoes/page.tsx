'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTH_SESSION_EVENT, getAuthToken } from '@/lib/auth-token';
import api from '@/lib/api';
import {
  clearTenantFeaturesCache,
  fetchTenantFeatures,
} from '@/hooks/useTenantFeatures';
import { EmitenteFiscalForm } from '@/features/nfe/EmitenteFiscalForm';

type MeUser = {
  role: string;
};

type TenantFeaturesConfig = {
  clienteCpf: boolean;
  frete: boolean;
  nfe: boolean;
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
        Módulos e opções da organização.
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
              <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!features.nfe}
                  onChange={(e) =>
                    setFeatures((f) => (f ? { ...f, nfe: e.target.checked } : f))
                  }
                  className="w-4 h-4 rounded mt-0.5"
                />
                <span>
                  Habilitar emissão de NF-e (nota fiscal eletrônica)
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Deixe desmarcado até ter o certificado A1 no provedor. Enquanto
                    isso, as vendas são só sem nota. Ao ligar, a nova venda passa a
                    ter as duas opções: sem nota ou com NF-e.
                  </span>
                </span>
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
      ) : (
        <p className="text-sm text-gray-500">
          Apenas administradores podem alterar as configurações da organização.
        </p>
      )}

      {isAdmin && features?.nfe ? (
        <section className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Dados fiscais do emitente</h2>
          <p className="text-sm text-gray-500 mb-4">
            CNPJ, IE, CRT e endereço da empresa que emite a NF-e. Confirme NCM/CFOP/CST com o contador.
          </p>
          <EmitenteFiscalForm />
        </section>
      ) : null}
    </div>
  );
}
