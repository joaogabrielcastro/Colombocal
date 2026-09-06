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

/** Colombocal: checkbox "Frete pago" vem marcado por padrão (e permanece ativo). */
function tenantFretePagoDefault(slug) {
  if (!slug) return false;
  const s = String(slug).trim().toLowerCase();
  return s === "default" || s === "colombocal";
}

/**
 * NF-e é opt-in: desligada até o admin marcar em Configurações (depois do certificado).
 * Env NFE_TENANT_SLUGS liga o fallback por slug, sem gravar ConfigSistema.
 */
function getNfeTenantSlugs() {
  const multi = process.env.NFE_TENANT_SLUGS;
  if (multi && String(multi).trim()) {
    return [
      ...new Set(
        String(multi)
          .split(/[,;]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

function tenantAllowsNfe(slug) {
  if (!slug) return false;
  return getNfeTenantSlugs().includes(String(slug).trim().toLowerCase());
}

module.exports = {
  getClientCpfTenantSlugs,
  getNoFreteTenantSlugs,
  getNfeTenantSlugs,
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
  tenantFretePagoDefault,
  tenantAllowsNfe,
};
