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
    const [vendasPorCliente, pagamentosPorCliente] = await Promise.all([
      tx.venda.groupBy({
        by: ["clienteId"],
        _sum: { valorTotal: true },
      }),
      tx.pagamento.groupBy({
        by: ["clienteId"],
        _sum: { valor: true },
      }),
    ]);

    const totalVendasByCliente = new Map(
      vendasPorCliente.map((row) => [
        row.clienteId,
        parseFloat(String(row._sum.valorTotal ?? 0)),
      ]),
    );
    const totalPagamentosByCliente = new Map(
      pagamentosPorCliente.map((row) => [
        row.clienteId,
        parseFloat(String(row._sum.valor ?? 0)),
      ]),
    );

    let ajustesCriados = 0;
    const ajustes = [];

    for (const { id: clienteId } of clientes) {
      const debitos = totalVendasByCliente.get(clienteId) ?? 0;
      const creditos = totalPagamentosByCliente.get(clienteId) ?? 0;
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
  }, { maxWait: 15000, timeout: 120000 });
}

module.exports = { executarResetFinanceiroLegacy, EPS };
