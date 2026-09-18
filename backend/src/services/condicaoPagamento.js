const { CONDICOES_PADRAO } = require("../domain/financeiro/parcelamento");

/**
 * Garante condições de pagamento padrão para o tenant (idempotente).
 */
async function ensureCondicoesPadrao(prisma, tenantId) {
  for (const c of CONDICOES_PADRAO) {
    await prisma.condicaoPagamento.upsert({
      where: {
        tenantId_nome: { tenantId: Number(tenantId), nome: c.nome },
      },
      create: {
        tenantId: Number(tenantId),
        nome: c.nome,
        descricao: c.descricao || null,
        diasParcelas: c.diasParcelas,
        ativo: true,
      },
      update: {},
    });
  }
}

async function findCondicaoFallback30(prisma, tenantId) {
  await ensureCondicoesPadrao(prisma, tenantId);
  return prisma.condicaoPagamento.findFirst({
    where: { tenantId: Number(tenantId), nome: "30", ativo: true },
  });
}

/**
 * Resolve condição: override id → cliente → fallback 30.
 */
async function resolveCondicaoPagamento(prisma, {
  tenantId,
  condicaoPagamentoId,
  clienteCondicaoPagamentoId,
}) {
  const tid = Number(tenantId);
  if (condicaoPagamentoId != null) {
    const c = await prisma.condicaoPagamento.findFirst({
      where: { id: Number(condicaoPagamentoId), tenantId: tid, ativo: true },
    });
    if (c) return c;
  }
  if (clienteCondicaoPagamentoId != null) {
    const c = await prisma.condicaoPagamento.findFirst({
      where: {
        id: Number(clienteCondicaoPagamentoId),
        tenantId: tid,
        ativo: true,
      },
    });
    if (c) return c;
  }
  return findCondicaoFallback30(prisma, tid);
}

module.exports = {
  ensureCondicoesPadrao,
  findCondicaoFallback30,
  resolveCondicaoPagamento,
};
