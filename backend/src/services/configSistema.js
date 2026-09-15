const DEFAULTS = {
  // Produto: comissão sempre por emissão. Modo "caixa" descontinuado (não usado em produção).
  COMISSAO_MODO: "emissao",
};

async function getConfig(prisma, tenantId, chave) {
  // findFirst (não findUnique): funciona mesmo se o índice único composto
  // estiver ausente no Postgres (upsert/ON CONFLICT quebraria).
  const row = await prisma.configSistema.findFirst({
    where: { tenantId, chave },
    orderBy: { id: "desc" },
  });
  return row?.valor ?? DEFAULTS[chave] ?? null;
}

/**
 * Grava parâmetro por tenant sem depender de upsert/ON CONFLICT.
 * Em bases legadas o índice único (tenantId, chave) às vezes falta — o upsert
 * falha com "Invalid `prisma.configSistema.upsert()`", enquanto SELECT ainda funciona.
 */
async function setConfig(prisma, tenantId, chave, valor) {
  const valorStr = String(valor);
  const existing = await prisma.configSistema.findFirst({
    where: { tenantId, chave },
    orderBy: { id: "desc" },
  });
  if (existing) {
    return prisma.configSistema.update({
      where: { id: existing.id },
      data: { valor: valorStr },
    });
  }
  try {
    return await prisma.configSistema.create({
      data: { tenantId, chave, valor: valorStr },
    });
  } catch (e) {
    // Corrida rara ou índice único presente: outra linha surgiu entre o find e o create.
    if (e?.code === "P2002") {
      const again = await prisma.configSistema.findFirst({
        where: { tenantId, chave },
        orderBy: { id: "desc" },
      });
      if (again) {
        return prisma.configSistema.update({
          where: { id: again.id },
          data: { valor: valorStr },
        });
      }
    }
    throw e;
  }
}

module.exports = {
  getConfig,
  setConfig,
  DEFAULTS,
};
