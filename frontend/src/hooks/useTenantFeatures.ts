"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  TENANT_FEATURES_DEFAULTS,
  clearTenantFeaturesCache,
  getTenantFeaturesCache,
  setTenantFeaturesCache,
  type TenantFeatures,
} from "@/lib/tenant-features-cache";

export type { TenantFeatures };

let inflight: Promise<TenantFeatures> | null = null;

export { clearTenantFeaturesCache };

export function fetchTenantFeatures(): Promise<TenantFeatures> {
  const cached = getTenantFeaturesCache();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .get<{ features?: Partial<TenantFeatures> }>("/auth/me")
      .then((r) => {
        const next: TenantFeatures = {
          clienteCpf: !!r.features?.clienteCpf,
          frete: r.features?.frete !== false,
        };
        setTenantFeaturesCache(next);
        return next;
      })
      .catch(() => TENANT_FEATURES_DEFAULTS)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useTenantFeatures() {
  const [features, setFeatures] = useState<TenantFeatures>(
    () => getTenantFeaturesCache() ?? TENANT_FEATURES_DEFAULTS,
  );
  const [loading, setLoading] = useState(() => getTenantFeaturesCache() == null);

  useEffect(() => {
    let cancelled = false;
    void fetchTenantFeatures().then((f) => {
      if (!cancelled) {
        setFeatures(f);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    features,
    loading,
    freteEnabled: features.frete,
    clienteCpfEnabled: features.clienteCpf,
  };
}
