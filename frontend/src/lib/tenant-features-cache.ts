/** Cache em memória das features do tenant (limpo ao trocar login). */
export type TenantFeatures = {
  clienteCpf: boolean;
  frete: boolean;
};

export const TENANT_FEATURES_DEFAULTS: TenantFeatures = {
  clienteCpf: false,
  frete: true,
};

let cache: TenantFeatures | null = null;

export function getTenantFeaturesCache(): TenantFeatures | null {
  return cache;
}

export function setTenantFeaturesCache(value: TenantFeatures) {
  cache = value;
}

export function clearTenantFeaturesCache() {
  cache = null;
}
