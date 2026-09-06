const { getConfig } = require("./configSistema");
const {
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
  tenantFretePagoDefault,
  tenantAllowsNfe,
} = require("../constants/tenantFeatures");
const { clearTenantSlugCache } = require("../utils/tenantRequest");

function parseBoolConfig(val) {
  if (val == null) return null;
  const s = String(val).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "sim") return true;
  if (s === "false" || s === "0" || s === "no" || s === "nao" || s === "não") {
    return false;
  }
  return null;
}

/**
 * Features por tenant: ConfigSistema (prioridade) → fallback slug/env legado.
 */
async function getTenantFeatures(prisma, tenantId, slug) {
  const [cpfRow, freteRow, nfeRow] = await Promise.all([
    getConfig(prisma, tenantId, "CLIENTE_CPF_ENABLED"),
    getConfig(prisma, tenantId, "FRETE_ENABLED"),
    getConfig(prisma, tenantId, "NFE_ENABLED"),
  ]);

  const cpfFromDb = parseBoolConfig(cpfRow);
  const freteFromDb = parseBoolConfig(freteRow);
  const nfeFromDb = parseBoolConfig(nfeRow);

  return {
    clienteCpf:
      cpfFromDb != null ? cpfFromDb : tenantAllowsClienteCpf(slug),
    frete: freteFromDb != null ? freteFromDb : tenantAllowsFrete(slug),
    fretePagoDefault: tenantFretePagoDefault(slug),
    nfe: nfeFromDb != null ? nfeFromDb : tenantAllowsNfe(slug),
  };
}

async function setTenantFeatures(prisma, tenantId, { clienteCpf, frete, nfe }) {
  const { setConfig } = require("./configSistema");
  if (clienteCpf !== undefined) {
    await setConfig(
      prisma,
      tenantId,
      "CLIENTE_CPF_ENABLED",
      clienteCpf ? "true" : "false",
    );
  }
  if (frete !== undefined) {
    await setConfig(prisma, tenantId, "FRETE_ENABLED", frete ? "true" : "false");
  }
  if (nfe !== undefined) {
    await setConfig(prisma, tenantId, "NFE_ENABLED", nfe ? "true" : "false");
  }
  clearTenantSlugCache();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  return getTenantFeatures(prisma, tenantId, tenant?.slug ?? null);
}

module.exports = {
  getTenantFeatures,
  setTenantFeatures,
  parseBoolConfig,
};
