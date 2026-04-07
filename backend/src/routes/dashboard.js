const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { getConfig } = require("../services/configSistema");
const { handleRouteError } = require("../utils/api");

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
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
      chequesPendentes,
      totalProdutosAtivos,
      ultimasVendas,
      comissaoModo,
    ] = await Promise.all([
      prisma.venda.findMany({
        where: { dataVenda: { gte: inicioDia, lte: fimDia } },
        include: { cliente: true },
      }),
      prisma.venda.aggregate({
        where: { dataVenda: { gte: inicioMes, lte: fimMes } },
        _sum: { valorTotal: true },
        _count: { id: true },
      }),
      prisma.tituloReceber.groupBy({
        by: ["clienteId"],
        where: { status: { in: ["aberto", "parcial"] } },
        _sum: { valorOriginal: true, valorPago: true },
      }),
      prisma.cliente.findMany({
        where: { ativo: true },
        select: { id: true, razaoSocial: true, nomeFantasia: true, telefone: true },
      }),
      prisma.cheque.aggregate({
        where: { status: { in: ["a_receber", "recebido"] } },
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.produto.count({
        where: { ativo: true },
      }),
      prisma.venda.findMany({
        take: 5,
        orderBy: { dataVenda: "desc" },
        include: { cliente: true, vendedor: true },
      }),
      getConfig(prisma, "COMISSAO_MODO"),
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
    const totalChequesPendentes = parseFloat(
      String(chequesPendentes._sum?.valor ?? 0),
    );

    // Faturamento dos últimos 6 meses: uma única query ao invés de 6 consultas separadas.
    const inicioJanela = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    const rawMeses = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "dataVenda") AS mes_inicio,
        SUM("valorTotal")::float         AS total
      FROM "Venda"
      WHERE "dataVenda" >= ${inicioJanela}
      GROUP BY DATE_TRUNC('month', "dataVenda")
      ORDER BY mes_inicio ASC
    `;

    // Gera os 6 meses esperados (pode haver meses sem vendas) e cruza com o resultado
    const totalPorMes = new Map(
      rawMeses.map((r) => [
        new Date(r.mes_inicio).toISOString().slice(0, 7), // "YYYY-MM"
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

    res.json({
      vendasHoje: vendasHoje.length,
      faturamentoHoje,
      faturamentoMes,
      quantidadeVendasMes: aggMes._count.id,
      clientesDevendo: clientesDevendo.length,
      totalEmAberto,
      chequesPendentes: chequesPendentes._count?.id ?? 0,
      totalChequesPendentes,
      totalProdutosAtivos,
      ultimasVendas,
      faturamentoPorMes: faturamentoMeses,
      regras: {
        comissaoModo: comissaoModo === "caixa" ? "caixa" : "emissao",
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/dashboard/cobranca — painel decisório (títulos + alertas)
router.get("/cobranca", async (req, res) => {
  try {
    const hoje = new Date();
    const fimHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
    );
    const inicioHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    );

    const emAbertoWhere = { status: { in: ["aberto", "parcial"] } };

    const [vencidos, venceHoje, proximos, chequesDevolv, freteSemRecibo] =
      await Promise.all([
        prisma.tituloReceber.findMany({
          where: {
            ...emAbertoWhere,
            vencimento: { lt: inicioHoje },
          },
          include: {
            cliente: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                telefone: true,
              },
            },
            venda: { select: { id: true, dataVenda: true } },
          },
          orderBy: { vencimento: "asc" },
          take: 100,
        }),
        prisma.tituloReceber.findMany({
          where: {
            ...emAbertoWhere,
            vencimento: { gte: inicioHoje, lte: fimHoje },
          },
          include: {
            cliente: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                telefone: true,
              },
            },
            venda: { select: { id: true, dataVenda: true } },
          },
          orderBy: { vencimento: "asc" },
          take: 80,
        }),
        prisma.tituloReceber.findMany({
          where: {
            ...emAbertoWhere,
            vencimento: { gt: fimHoje, lte: new Date(hoje.getTime() + 7 * 86400000) },
          },
          include: {
            cliente: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                telefone: true,
              },
            },
            venda: { select: { id: true, dataVenda: true } },
          },
          orderBy: { vencimento: "asc" },
          take: 50,
        }),
        prisma.cheque.findMany({
          where: { status: "devolvido" },
          include: {
            cliente: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                telefone: true,
              },
            },
          },
          orderBy: { dataRecebimento: "desc" },
          take: 30,
        }),
        prisma.freteMovimento.findMany({
          where: {
            OR: [{ reciboEmitido: false }, { reciboNumero: null }],
            valor: { gt: 0 },
          },
          include: {
            cliente: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
              },
            },
            venda: { select: { id: true } },
          },
          orderBy: { data: "desc" },
          take: 40,
        }),
      ]);

    const valorAberto = (t) =>
      Math.max(
        0,
        parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
      );

    const resumo = {
      titulosVencidos: vencidos.length,
      valorVencido: vencidos.reduce((a, t) => a + valorAberto(t), 0),
      titulosVenceHoje: venceHoje.length,
      valorVenceHoje: venceHoje.reduce((a, t) => a + valorAberto(t), 0),
      chequesDevolvidos: chequesDevolv.length,
      fretesSemRecibo: freteSemRecibo.length,
    };

    const topClienteMap = new Map();
    for (const t of vencidos) {
      const cid = t.clienteId;
      const v = valorAberto(t);
      topClienteMap.set(cid, (topClienteMap.get(cid) || 0) + v);
    }
    const topInadimplentes = [...topClienteMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([clienteId, valor]) => {
        const row = vencidos.find((x) => x.clienteId === clienteId);
        return {
          clienteId,
          valor,
          cliente: row?.cliente,
        };
      });

    res.json({
      resumo,
      vencidos,
      venceHoje,
      proximos7Dias: proximos,
      chequesDevolvidos: chequesDevolv,
      fretesPendentesRecibo: freteSemRecibo,
      topInadimplentes,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
