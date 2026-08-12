const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError } = require("../utils/api");
const { calcularSaldoAbertoVenda } = require("../domain/financeiro/saldoVenda");
const {
  listarDivergenciasContaTitulos,
} = require("../services/financeiroDivergencias");

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
      aggHoje,
      aggMes,
      titulosAgg,
      chequesEmMaosAgg,
      totalProdutosAtivos,
      totalClientesAtivos,
      totalVendas,
      totalRecebimentos,
      ultimasVendas,
      divergenciasFinanceiras,
    ] = await Promise.all([
      prisma.venda.aggregate({
        where: { ...tw, dataVenda: { gte: inicioDia, lte: fimDia } },
        _sum: { valorTotal: true },
        _count: { id: true },
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
      prisma.cheque.aggregate({
        // Novos cheques nascem como "registrado"; "ativo" era legado.
        where: { ...tw, status: { in: ["registrado", "ativo"] } },
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.produto.count({
        where: { ...tw, ativo: true },
      }),
      prisma.cliente.count({
        where: { ...tw, ativo: true },
      }),
      prisma.venda.count({ where: tw }),
      prisma.pagamento.count({ where: tw }),
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
      listarDivergenciasContaTitulos(prisma, tenantId, { take: 5 }),
    ]);

    const faturamentoHoje = parseFloat(String(aggHoje._sum.valorTotal || 0));
    const faturamentoMes = parseFloat(String(aggMes._sum.valorTotal || 0));

    const clientesDevendoRows = [];
    for (const a of titulosAgg) {
      const debito = parseFloat(String(a._sum.valorOriginal || 0));
      const pago = parseFloat(String(a._sum.valorPago || 0));
      const aberto = Math.max(0, debito - pago);
      if (aberto > 0.009) {
        clientesDevendoRows.push({ clienteId: a.clienteId, aberto });
      }
    }
    clientesDevendoRows.sort((a, b) => b.aberto - a.aberto);

    const totalEmAberto = clientesDevendoRows.reduce((acc, c) => acc + c.aberto, 0);
    const topIds = clientesDevendoRows.slice(0, 5).map((c) => c.clienteId);
    const topClientes =
      topIds.length === 0
        ? []
        : await prisma.cliente.findMany({
            where: { tenantId, id: { in: topIds }, ativo: true },
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
            },
          });
    const clienteMap = new Map(topClientes.map((c) => [c.id, c]));
    const topClientesDevendo = topIds
      .map((id) => {
        const c = clienteMap.get(id);
        const row = clientesDevendoRows.find((x) => x.clienteId === id);
        if (!c || !row) return null;
        return {
          id: c.id,
          nome: (c.nomeFantasia && String(c.nomeFantasia).trim()) || c.razaoSocial,
          aberto: row.aberto,
        };
      })
      .filter(Boolean);

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
    const mesesCurto = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    const faturamentoMeses = [5, 4, 3, 2, 1, 0].map((i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = d.toISOString().slice(0, 7);
      const ano2 = String(d.getFullYear()).slice(-2);
      return {
        mes: `${mesesCurto[d.getMonth()]}/${ano2}`,
        total: totalPorMes.get(chave) ?? 0,
      };
    });

    const ultimasVendasResumo = ultimasVendas.map((v) => {
      const totalRecebido = (v.pagamentos || []).reduce(
        (acc, p) => acc + parseFloat(String(p.valor || 0)),
        0,
      );
      // saldoOrdem = em aberto (títulos − pagos); positivo = ainda deve. Mesma regra de saldoVenda.
      const saldoOrdem = calcularSaldoAbertoVenda(v);
      const { pagamentos, titulos, ...rest } = v;
      return {
        ...rest,
        totalRecebido,
        saldoOrdem,
        quitada: saldoOrdem <= 0.009,
      };
    });

    res.json({
      vendasHoje: aggHoje._count.id,
      faturamentoHoje,
      faturamentoMes,
      quantidadeVendasMes: aggMes._count.id,
      clientesDevendo: clientesDevendoRows.length,
      totalEmAberto,
      topClientesDevendo,
      chequesRegistrados: chequesEmMaosAgg._count?.id ?? 0,
      totalChequesRegistrados: totalChequesEmMaos,
      totalProdutosAtivos,
      ultimasVendas: ultimasVendasResumo,
      faturamentoPorMes: faturamentoMeses,
      onboarding: {
        clientes: totalClientesAtivos,
        produtos: totalProdutosAtivos,
        vendas: totalVendas,
        recebimentos: totalRecebimentos,
      },
      regras: {
        // Produto: comissão apenas por emissão (modo caixa descontinuado).
        comissaoModo: "emissao",
      },
      /** Conta corrente auxiliar vs títulos (SSOT). */
      divergenciasFinanceiras,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
