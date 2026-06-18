function getRegistrationTenantSlug() {
  const s = process.env.REGISTRATION_TENANT_SLUG;
  return (s && String(s).trim().toLowerCase()) || "default";
}

/** Slugs permitidos no cadastro público (REGISTRATION_TENANT_SLUGS ou um único REGISTRATION_TENANT_SLUG). */
function getRegistrationTenantSlugs() {
  const multi = process.env.REGISTRATION_TENANT_SLUGS;
  if (multi && String(multi).trim()) {
    const slugs = String(multi)
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (slugs.length > 0) return [...new Set(slugs)];
  }
  return [getRegistrationTenantSlug()];
}

async function loadRegistrationTenants(prisma) {
  const slugs = getRegistrationTenantSlugs();
  const rows = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  const bySlug = new Map(rows.filter((t) => t.slug).map((t) => [t.slug, t]));
  return slugs.map((slug) => bySlug.get(slug)).filter(Boolean);
}

function resolveRegistrationTenantSlug(body, tenants) {
  if (!tenants.length) {
    const err = new Error("Nenhuma organização disponível para cadastro");
    err.statusCode = 503;
    throw err;
  }

  const requested =
    body?.tenantSlug != null && String(body.tenantSlug).trim()
      ? String(body.tenantSlug).trim().toLowerCase()
      : null;

  if (tenants.length === 1) {
    return tenants[0].slug;
  }

  if (!requested) {
    const err = new Error("Selecione a organização");
    err.statusCode = 400;
    throw err;
  }

  const allowed = tenants.some((t) => t.slug === requested);
  if (!allowed) {
    const err = new Error("Organização inválida para cadastro");
    err.statusCode = 400;
    throw err;
  }
  return requested;
}

module.exports = {
  getRegistrationTenantSlug,
  getRegistrationTenantSlugs,
  loadRegistrationTenants,
  resolveRegistrationTenantSlug,
};
