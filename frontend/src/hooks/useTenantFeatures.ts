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
  const tid = getAuthTenantId();
  const [features, setFeatures] = useState<TenantFeatures>(
    () => getTenantFeaturesCache(tid) ?? TENANT_FEATURES_DEFAULTS,
  );
  const [loading, setLoading] = useState(() => getTenantFeaturesCache(tid) == null);

  useEffect(() => {
    let cancelled = false;

    const load = (force = false) => {
      void fetchTenantFeatures(force).then((f) => {
        if (!cancelled) {
          setFeatures(f);
          setLoading(false);
        }
      });
    };

    load(true);

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
  };
}
