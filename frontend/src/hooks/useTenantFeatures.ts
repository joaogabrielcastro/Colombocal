"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export type TenantFeatures = {
  clienteCpf: boolean;
  frete: boolean;
};

const DEFAULTS: TenantFeatures = { clienteCpf: false, frete: true };

let cache: TenantFeatures | null = null;
let inflight: Promise<TenantFeatures> | null = null;

export function fetchTenantFeatures(): Promise<TenantFeatures> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get<{ features?: Partial<TenantFeatures> }>("/auth/me")
      .then((r) => {
        cache = {
          clienteCpf: !!r.features?.clienteCpf,
          frete: r.features?.frete !== false,
        };
        return cache;
      })
      .catch(() => DEFAULTS)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useTenantFeatures() {
  const [features, setFeatures] = useState<TenantFeatures>(cache ?? DEFAULTS);
  const [loading, setLoading] = useState(cache == null);

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
