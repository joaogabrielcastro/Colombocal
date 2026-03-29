const DEFAULTS = {
  COMISSAO_MODO: "emissao", // emissao | caixa
};

async function getConfig(prisma, chave) {
  const row = await prisma.configSistema.findUnique({ where: { chave } });
  return row?.valor ?? DEFAULTS[chave] ?? null;
}

async function setConfig(prisma, chave, valor) {
  return prisma.configSistema.upsert({
    where: { chave },
    create: { chave, valor: String(valor) },
    update: { valor: String(valor) },
  });
}

module.exports = {
  getConfig,
  setConfig,
  DEFAULTS,
};
