function getClientCpfTenantSlugs() {
  /** Padrão: Requinte cadastra cliente por CPF (igual ao histórico do produto). */
  const defaults = ["requinte"];
  const multi = process.env.CLIENT_CPF_TENANT_SLUGS;
  if (multi && String(multi).trim()) {
    const fromEnv = String(multi)
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set([...defaults, ...fromEnv])];
  }
  return defaults;
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
  const s = String(slug).trim().toLowerCase();
  // Colombocal / tenant padrão: frete sempre disponível (não bloqueia por env acidental)
  if (s === "default" || s === "colombocal") return true;
  return !getNoFreteTenantSlugs().includes(s);
}

module.exports = {
  getClientCpfTenantSlugs,
  getNoFreteTenantSlugs,
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
};
