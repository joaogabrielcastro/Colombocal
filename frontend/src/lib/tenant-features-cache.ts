/** Cache das features do tenant, amarrado ao tenantId do JWT. */
export type TenantFeatures = {
  clienteCpf: boolean;
  frete: boolean;
};

type StoredFeatures = TenantFeatures & { tenantId: number };

const STORAGE_KEY = "colombocal_tenant_features_v2";

/** Fallback só se /auth/me falhar — conservador (sem frete). */
export const TENANT_FEATURES_DEFAULTS: TenantFeatures = {
  clienteCpf: false,
  frete: false,
};

let cache: StoredFeatures | null = null;

function readStorage(): StoredFeatures | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFeatures>;
    const tenantId = Number(parsed.tenantId);
    if (!Number.isFinite(tenantId) || tenantId < 1) return null;
    return {
      tenantId,
      clienteCpf: !!parsed.clienteCpf,
      frete: !!parsed.frete,
    };
  } catch {
    return null;
  }
}

function writeStorage(value: StoredFeatures | null) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem("colombocal_tenant_features");
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    /* ignore */
  }
}

export function getTenantFeaturesCache(tenantId?: number | null): TenantFeatures | null {
  const tid = tenantId != null && tenantId > 0 ? tenantId : null;
  const current = cache ?? readStorage();
  if (!current) return null;
  if (tid != null && current.tenantId !== tid) {
    clearTenantFeaturesCache();
    return null;
  }
  if (!cache) cache = current;
  return { clienteCpf: current.clienteCpf, frete: current.frete };
}

export function setTenantFeaturesCache(
  value: TenantFeatures,
  tenantId?: number | null,
) {
  const tid = tenantId != null && Number(tenantId) > 0 ? Number(tenantId) : null;
  if (tid == null) {
    cache = null;
    writeStorage(null);
    return;
  }
  cache = { tenantId: tid, clienteCpf: !!value.clienteCpf, frete: !!value.frete };
  writeStorage(cache);
}

export function clearTenantFeaturesCache() {
  cache = null;
  writeStorage(null);
}
