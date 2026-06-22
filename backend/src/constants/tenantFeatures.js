function getClientCpfTenantSlugs() {
  const multi = process.env.CLIENT_CPF_TENANT_SLUGS;
  if (multi && String(multi).trim()) {
    const slugs = String(multi)
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (slugs.length > 0) return [...new Set(slugs)];
  }
  return [];
}

/** Tenants sem módulo de frete (padrão: requinte). Env: NO_FRETE_TENANT_SLUGS */
function getNoFreteTenantSlugs() {
  const defaults = ["requinte"];
  const multi = process.env.NO_FRETE_TENANT_SLUGS;
  if (multi && String(multi).trim()) {
    const fromEnv = String(multi)
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set([...defaults, ...fromEnv])];
  }
  return defaults;
}

function tenantAllowsClienteCpf(slug) {
  if (!slug) return false;
  return getClientCpfTenantSlugs().includes(String(slug).trim().toLowerCase());
}

function tenantAllowsFrete(slug) {
  if (!slug) return true;
  return !getNoFreteTenantSlugs().includes(String(slug).trim().toLowerCase());
}

module.exports = {
  getClientCpfTenantSlugs,
  getNoFreteTenantSlugs,
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
};
