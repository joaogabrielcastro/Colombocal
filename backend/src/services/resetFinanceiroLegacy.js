const EPS = 0.009;

/**
 * Quita títulos, remove cheques e pagamentos de cheque, cria ajustes de transferência
 * para zerar débito na conta corrente (vendas − pagamentos).
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function executarResetFinanceiroLegacy(prisma) {
  return prisma.$transaction(async (tx) => {
    const titulosAntes = await tx.tituloReceber.count();
    await tx.$executeRaw`
      UPDATE "TituloReceber"
      SET "valorPago" = "valorOriginal",
          "status" = 'quitado',
          "updatedAt" = CURRENT_TIMESTAMP
    `;

    const pagamentosCheque = await tx.pagamento.count({
      where: { chequeId: { not: null } },
    });
    await tx.pagamento.deleteMany({ where: { chequeId: { not: null } } });

    const chequesAntes = await tx.cheque.count();
    await tx.cheque.deleteMany({});

    const clientes = await tx.cliente.findMany({ select: { id: true } });
    let ajustesCriados = 0;
    const ajustes = [];

    for (const { id: clienteId } of clientes) {
      const [aggV, aggP] = await Promise.all([
        tx.venda.aggregate({
          where: { clienteId },
          _sum: { valorTotal: true },
        }),
        tx.pagamento.aggregate({
          where: { clienteId },
          _sum: { valor: true },
        }),
      ]);
      const debitos = parseFloat(String(aggV._sum.valorTotal ?? 0));
      const creditos = parseFloat(String(aggP._sum.valor ?? 0));
      const falta = debitos - creditos;
      if (falta > EPS) {
        const rounded = Math.round(falta * 100) / 100;
        const p = await tx.pagamento.create({
          data: {
            clienteId,
            vendaId: null,
            tipo: "transferencia",
            valor: rounded,
            data: new Date(),
            observacoes:
              "Ajuste automático: encerramento de saldo devedor legado (reset financeiro).",
          },
        });
        ajustesCriados++;
        ajustes.push({ clienteId, valor: rounded, pagamentoId: p.id });
      }
    }

    return {
      titulosAlterados: titulosAntes,
      pagamentosChequeRemovidos: pagamentosCheque,
      chequesRemovidos: chequesAntes,
      ajustesCriados,
      ajustes,
    };
  });
}

module.exports = { executarResetFinanceiroLegacy, EPS };
