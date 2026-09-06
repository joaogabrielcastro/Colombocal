"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AUTH_SESSION_EVENT, getAuthTenantId } from "@/lib/auth-token";
import {
  TENANT_FEATURES_DEFAULTS,
  clearTenantFeaturesCache,
  getTenantFeaturesCache,
  setTenantFeaturesCache,
  type TenantFeatures,
} from "@/lib/tenant-features-cache";

export type { TenantFeatures };

let inflight: Promise<TenantFeatures> | null = null;
let inflightTenantId: number | null = null;

export { clearTenantFeaturesCache, setTenantFeaturesCache };

export function fetchTenantFeatures(force = false): Promise<TenantFeatures> {
  const tid = getAuthTenantId();
  if (!force) {
    const cached = getTenantFeaturesCache(tid);
    if (cached) return Promise.resolve(cached);
  }
  if (inflight && inflightTenantId === tid) return inflight;

  inflightTenantId = tid;
  inflight = api
    .get<{
      features?: Partial<TenantFeatures>;
      user?: { tenantId?: number };
      tenant?: { slug?: string };
    }>("/auth/me")
    .then((r) => {
      const next: TenantFeatures = {
        clienteCpf: !!r.features?.clienteCpf,
        frete: !!r.features?.frete,
        fretePagoDefault: !!r.features?.fretePagoDefault,
        nfe: !!r.features?.nfe,
      };
      const meTid = Number(r.user?.tenantId) || tid;
      setTenantFeaturesCache(next, meTid);
      return next;
    })
    .catch(() => getTenantFeaturesCache(tid) ?? TENANT_FEATURES_DEFAULTS)
    .finally(() => {
      inflight = null;
      inflightTenantId = null;
    });

  return inflight;
}

export function useTenantFeatures() {
  // Sempre começa nos defaults para SSR e 1º paint no cliente baterem (evita hydration mismatch
  // quando sessionStorage já tem frete=true).
  const [features, setFeatures] = useState<TenantFeatures>(TENANT_FEATURES_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = (force = false) => {
      const tid = getAuthTenantId();
      if (!force) {
        const cached = getTenantFeaturesCache(tid);
        if (cached && !cancelled) {
          setFeatures(cached);
          setLoading(false);
        }
      }
      void fetchTenantFeatures(force).then((f) => {
        if (!cancelled) {
          setFeatures(f);
          setLoading(false);
        }
      });
    };

    // Aplica cache imediatamente após mount, depois confirma com a API
    load(false);

    const onAuth = () => {
      setLoading(true);
      setFeatures(TENANT_FEATURES_DEFAULTS);
      load(true);
    };
    window.addEventListener(AUTH_SESSION_EVENT, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EVENT, onAuth);
    };
  }, []);

  return {
    features,
    loading,
    freteEnabled: features.frete,
    clienteCpfEnabled: features.clienteCpf,
    fretePagoDefault: features.fretePagoDefault,
    nfeEnabled: features.nfe,
  };
}
