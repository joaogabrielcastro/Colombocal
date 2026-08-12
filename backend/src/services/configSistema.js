const DEFAULTS = {
  // Produto: comissão sempre por emissão. Modo "caixa" descontinuado (não usado em produção).
  COMISSAO_MODO: "emissao",
};

async function getConfig(prisma, tenantId, chave) {
  const row = await prisma.configSistema.findUnique({
    where: { tenantId_chave: { tenantId, chave } },
  });
  return row?.valor ?? DEFAULTS[chave] ?? null;
}

async function setConfig(prisma, tenantId, chave, valor) {
  return prisma.configSistema.upsert({
    where: { tenantId_chave: { tenantId, chave } },
    create: { tenantId, chave, valor: String(valor) },
    update: { valor: String(valor) },
  });
}

module.exports = {
  getConfig,
  setConfig,
  DEFAULTS,
};
