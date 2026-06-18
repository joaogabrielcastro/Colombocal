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

function tenantAllowsClienteCpf(slug) {
  if (!slug) return false;
  return getClientCpfTenantSlugs().includes(String(slug).trim().toLowerCase());
}

module.exports = {
  getClientCpfTenantSlugs,
  tenantAllowsClienteCpf,
};
