const { prisma } = require("../lib/prisma");
const { tenantAllowsFrete } = require("../constants/tenantFeatures");

const slugByTenantId = new Map();

async function getTenantSlug(tenantId) {
  if (slugByTenantId.has(tenantId)) return slugByTenantId.get(tenantId);
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  const slug = row?.slug ?? null;
  slugByTenantId.set(tenantId, slug);
  return slug;
}

async function requestAllowsFrete(req) {
  const slug = await getTenantSlug(req.tenantId);
  return tenantAllowsFrete(slug);
}

/** Limpa o cache de slug por tenant (uso em testes ao recriar tenants). */
function clearTenantSlugCache() {
  slugByTenantId.clear();
}

module.exports = {
  getTenantSlug,
  requestAllowsFrete,
  clearTenantSlugCache,
};
