const { getConfig } = require("./configSistema");
const {
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
  tenantFretePagoDefault,
  tenantAllowsNfe,
  tenantAllowsCte,
  tenantAllowsMdfe,
  tenantAllowsCiot,
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
  const [cpfRow, freteRow, nfeRow, cteRow, mdfeRow, ciotRow] = await Promise.all([
    getConfig(prisma, tenantId, "CLIENTE_CPF_ENABLED"),
    getConfig(prisma, tenantId, "FRETE_ENABLED"),
    getConfig(prisma, tenantId, "NFE_ENABLED"),
    getConfig(prisma, tenantId, "CTE_ENABLED"),
    getConfig(prisma, tenantId, "MDFE_ENABLED"),
    getConfig(prisma, tenantId, "CIOT_ENABLED"),
  ]);

  const cpfFromDb = parseBoolConfig(cpfRow);
  const freteFromDb = parseBoolConfig(freteRow);
  const nfeFromDb = parseBoolConfig(nfeRow);
  const cteFromDb = parseBoolConfig(cteRow);
  const mdfeFromDb = parseBoolConfig(mdfeRow);
  const ciotFromDb = parseBoolConfig(ciotRow);

  return {
    clienteCpf:
      cpfFromDb != null ? cpfFromDb : tenantAllowsClienteCpf(slug),
    frete: freteFromDb != null ? freteFromDb : tenantAllowsFrete(slug),
    fretePagoDefault: tenantFretePagoDefault(slug),
    nfe: nfeFromDb != null ? nfeFromDb : tenantAllowsNfe(slug),
    cte: cteFromDb != null ? cteFromDb : tenantAllowsCte(slug),
    mdfe: mdfeFromDb != null ? mdfeFromDb : tenantAllowsMdfe(slug),
    ciot: ciotFromDb != null ? ciotFromDb : tenantAllowsCiot(slug),
  };
}

async function setTenantFeatures(
  prisma,
  tenantId,
  { clienteCpf, frete, nfe, cte, mdfe, ciot },
) {
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
  if (cte !== undefined) {
    await setConfig(prisma, tenantId, "CTE_ENABLED", cte ? "true" : "false");
  }
  if (mdfe !== undefined) {
    await setConfig(prisma, tenantId, "MDFE_ENABLED", mdfe ? "true" : "false");
  }
  if (ciot !== undefined) {
    await setConfig(prisma, tenantId, "CIOT_ENABLED", ciot ? "true" : "false");
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
