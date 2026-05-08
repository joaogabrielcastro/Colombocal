const EPS = 0.009;

/**
 * Quita títulos, remove cheques e pagamentos de cheque, cria ajustes de transferência
 * para zerar débito na conta corrente (vendas − pagamentos).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ tenantId: number, criarAjustes?: boolean, zerarPagamentosGerais?: boolean, zerarVendasETitulos?: boolean }} options
 */
async function executarResetFinanceiroLegacy(prisma, options = {}) {
  const tenantId = options.tenantId;
  if (tenantId == null) {
    throw new Error("executarResetFinanceiroLegacy: tenantId obrigatório");
  }
  const tw = { tenantId };

  const criarAjustes = options.criarAjustes !== false;
  const zerarPagamentosGerais = options.zerarPagamentosGerais === true;
  const zerarVendasETitulos = options.zerarVendasETitulos === true;

  return prisma.$transaction(async (tx) => {
    const titulosAntes = await tx.tituloReceber.count({ where: tw });
    let titulosRemovidos = 0;
    if (zerarVendasETitulos) {
      const delTit = await tx.tituloReceber.deleteMany({ where: tw });
      titulosRemovidos = delTit.count;
    } else {
      await tx.$executeRaw`
        UPDATE "TituloReceber"
        SET "valorPago" = "valorOriginal",
            "status" = 'quitado',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "tenantId" = ${tenantId}
      `;
    }

    const pagamentosCheque = await tx.pagamento.count({
      where: { ...tw, chequeId: { not: null } },
    });
    await tx.pagamento.deleteMany({ where: { ...tw, chequeId: { not: null } } });

    let pagamentosGeraisRemovidos = 0;
    if (zerarPagamentosGerais) {
      const delPag = await tx.pagamento.deleteMany({ where: tw });
      pagamentosGeraisRemovidos = delPag.count;
    }

    const chequesAntes = await tx.cheque.count({ where: tw });
    await tx.cheque.deleteMany({ where: tw });

    let vendasRemovidas = 0;
    if (zerarVendasETitulos) {
      const delVendas = await tx.venda.deleteMany({ where: tw });
      vendasRemovidas = delVendas.count;
      await tx.freteMovimento.deleteMany({ where: tw });
    }

    let ajustesCriados = 0;
    const ajustes = [];

    if (criarAjustes) {
      const clientes = await tx.cliente.findMany({ where: tw, select: { id: true } });
      const [vendasPorCliente, pagamentosPorCliente] = await Promise.all([
        tx.venda.groupBy({
          by: ["clienteId"],
          where: tw,
          _sum: { valorTotal: true },
        }),
        tx.pagamento.groupBy({
          by: ["clienteId"],
          where: tw,
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

      for (const { id: clienteId } of clientes) {
        const debitos = totalVendasByCliente.get(clienteId) ?? 0;
        const creditos = totalPagamentosByCliente.get(clienteId) ?? 0;
        const falta = debitos - creditos;
        if (falta > EPS) {
          const rounded = Math.round(falta * 100) / 100;
          const p = await tx.pagamento.create({
            data: {
              tenantId,
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
    }

    return {
      titulosAlterados: titulosAntes,
      pagamentosChequeRemovidos: pagamentosCheque,
      pagamentosGeraisRemovidos,
      chequesRemovidos: chequesAntes,
      titulosRemovidos,
      vendasRemovidas,
      ajustesCriados,
      ajustes,
      modo: {
        criarAjustes,
        zerarPagamentosGerais,
        zerarVendasETitulos,
      },
    };
  }, { maxWait: 15000, timeout: 120000 });
}

module.exports = { executarResetFinanceiroLegacy, EPS };
