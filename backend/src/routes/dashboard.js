const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { getConfig } = require("../services/configSistema");
const { handleRouteError } = require("../utils/api");

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tw = { tenantId };

    const hoje = new Date();
    const inicioDia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    );
    const fimDia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
    );
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(
      hoje.getFullYear(),
      hoje.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const [
      vendasHoje,
      aggMes,
      titulosAgg,
      todosClientes,
      chequesEmMaosAgg,
      totalProdutosAtivos,
      ultimasVendas,
      comissaoModo,
    ] = await Promise.all([
      prisma.venda.findMany({
        where: { ...tw, dataVenda: { gte: inicioDia, lte: fimDia } },
        include: { cliente: true },
      }),
      prisma.venda.aggregate({
        where: { ...tw, dataVenda: { gte: inicioMes, lte: fimMes } },
        _sum: { valorTotal: true },
        _count: { id: true },
      }),
      prisma.tituloReceber.groupBy({
        by: ["clienteId"],
        where: { ...tw, status: { in: ["aberto", "parcial"] } },
        _sum: { valorOriginal: true, valorPago: true },
      }),
      prisma.cliente.findMany({
        where: { ...tw, ativo: true },
        select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true },
      }),
      prisma.cheque.aggregate({
        where: tw,
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.produto.count({
        where: { ...tw, ativo: true },
      }),
      prisma.venda.findMany({
        where: tw,
        take: 5,
        orderBy: { dataVenda: "desc" },
        include: {
          cliente: true,
          vendedor: true,
          pagamentos: { select: { valor: true } },
          titulos: { select: { valorOriginal: true } },
        },
      }),
      getConfig(prisma, tenantId, "COMISSAO_MODO"),
    ]);

    const faturamentoHoje = vendasHoje.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );
    const faturamentoMes = parseFloat(aggMes._sum.valorTotal || 0);

    const aggMap = new Map(
      titulosAgg.map((a) => [
        a.clienteId,
        {
          debito: parseFloat(a._sum.valorOriginal || 0),
          pago: parseFloat(a._sum.valorPago || 0),
        },
      ]),
    );

    const clientesDevendo = [];
    for (const c of todosClientes) {
      const agg = aggMap.get(c.id);
      if (!agg) continue;
      const aberto = Math.max(0, agg.debito - agg.pago);
      if (aberto > 0.009)
        clientesDevendo.push({ ...c, saldoTitulos: -aberto, aberto });
    }
    clientesDevendo.sort((a, b) => a.saldoTitulos - b.saldoTitulos);

    const totalEmAberto = clientesDevendo.reduce(
      (acc, c) => acc + c.aberto,
      0,
    );
    const totalChequesEmMaos = parseFloat(
      String(chequesEmMaosAgg._sum?.valor ?? 0),
    );

    const inicioJanela = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    const rawMeses = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "dataVenda") AS mes_inicio,
        SUM("valorTotal")::float         AS total
      FROM "Venda"
      WHERE "dataVenda" >= ${inicioJanela}
        AND "tenantId" = ${tenantId}
      GROUP BY DATE_TRUNC('month', "dataVenda")
      ORDER BY mes_inicio ASC
    `;

    const totalPorMes = new Map(
      rawMeses.map((r) => [
        new Date(r.mes_inicio).toISOString().slice(0, 7),
        parseFloat(String(r.total || 0)),
      ]),
    );
    const faturamentoMeses = [5, 4, 3, 2, 1, 0].map((i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = d.toISOString().slice(0, 7);
      return {
        mes: d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
        total: totalPorMes.get(chave) ?? 0,
      };
    });

    const ultimasVendasResumo = ultimasVendas.map((v) => {
      const totalRecebido = (v.pagamentos || []).reduce(
        (acc, p) => acc + parseFloat(String(p.valor || 0)),
        0,
      );
      const totalTitulo =
        (v.titulos || []).length > 0
          ? (v.titulos || []).reduce(
              (acc, t) => acc + parseFloat(String(t.valorOriginal || 0)),
              0,
            )
          : parseFloat(String(v.valorTotal || 0));
      const saldoOrdem = totalRecebido - totalTitulo;
      const { pagamentos, titulos, ...rest } = v;
      return {
        ...rest,
        totalRecebido,
        saldoOrdem,
        quitada: saldoOrdem >= -0.009,
      };
    });

    res.json({
      vendasHoje: vendasHoje.length,
      faturamentoHoje,
      faturamentoMes,
      quantidadeVendasMes: aggMes._count.id,
      clientesDevendo: clientesDevendo.length,
      totalEmAberto,
      topClientesDevendo: clientesDevendo.slice(0, 5).map((c) => ({
        id: c.id,
        nome: (c.nomeFantasia && String(c.nomeFantasia).trim()) || c.razaoSocial,
        aberto: c.aberto,
      })),
      chequesRegistrados: chequesEmMaosAgg._count?.id ?? 0,
      totalChequesRegistrados: totalChequesEmMaos,
      totalProdutosAtivos,
      ultimasVendas: ultimasVendasResumo,
      faturamentoPorMes: faturamentoMeses,
      regras: {
        comissaoModo: comissaoModo === "caixa" ? "caixa" : "emissao",
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
