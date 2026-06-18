const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError, parsePagination, setPaginationHeaders } = require("../utils/api");
const { getConfig } = require("../services/configSistema");
const {
  createExportJob,
  getExportJob,
  exportJobBelongsToTenant,
  markRunning,
  markCompleted,
  markFailed,
} = require("../services/exportJobs");
const { requireNavKey } = require("../middleware/navPermission");
const {
  comissaoPorEmissao,
  comissaoPorCaixa,
} = require("../services/comissao");
const { getDateRange } = require("../utils/dateRangeQuery");

const relatorioNavByPrefix = [
  ["/vendas", "rel_vendas"],
  ["/comissoes", "rel_comissoes"],
  ["/financeiro", "rel_financeiro"],
  ["/titulos", "rel_titulos"],
];

router.use((req, res, next) => {
  if (req.path.startsWith("/exports/")) return next();
  const match = relatorioNavByPrefix.find(
    ([prefix]) => req.path === prefix || req.path.startsWith(`${prefix}/`),
  );
  if (!match) return next();
  return requireNavKey(match[1])(req, res, next);
});

function buildTitulosWhere(query, tenantId) {
  const {
    clienteId,
    status,
    dataVencInicio,
    dataVencFim,
    somenteEmAberto,
    vendaId,
  } = query;

  const where = { tenantId };
  if (clienteId) where.clienteId = parseInt(clienteId, 10);
  if (vendaId != null && String(vendaId).trim() !== "") {
    const vid = parseInt(String(vendaId).replace(/^#/, "").trim(), 10);
    if (!Number.isNaN(vid) && vid > 0) where.vendaId = vid;
  }
  if (status) where.status = status;
  if (somenteEmAberto === "true") where.status = { in: ["aberto", "parcial"] };
  if (dataVencInicio || dataVencFim) {
    where.vencimento = getDateRange(dataVencInicio, dataVencFim);
  }
  return where;
}

function buildVendasWhere(query, tenantId) {
  const { dataInicio, dataFim, clienteId, vendedorId, produtoId, busca } = query;
  const where = { tenantId };
  if (clienteId) where.clienteId = parseInt(clienteId, 10);
  if (vendedorId) where.vendedorId = parseInt(vendedorId, 10);
  if (dataInicio || dataFim) where.dataVenda = getDateRange(dataInicio, dataFim);
  if (produtoId) {
    where.itens = { some: { produtoId: parseInt(produtoId, 10) } };
  }
  if (busca && String(busca).trim()) {
    const term = String(busca).trim();
    where.OR = [
      { cliente: { nomeFantasia: { contains: term, mode: "insensitive" } } },
      { cliente: { razaoSocial: { contains: term, mode: "insensitive" } } },
      { vendedor: { nome: { contains: term, mode: "insensitive" } } },
      { observacoes: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

// GET /api/relatorios/vendas
router.get("/vendas", async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 1000,
    });
    const where = buildVendasWhere(req.query, req.tenantId);

    const aggWhere = { ...where };
    const [totaisAgg, vendas, total, porVendedorAgg, porClienteAgg, porProdutoAgg] = await Promise.all([
      prisma.venda.aggregate({
        where: aggWhere,
        _sum: { valorTotal: true, frete: true },
        _count: { id: true },
      }),
      prisma.venda.findMany({
        where,
        include: {
          cliente: true,
          vendedor: true,
          motorista: true,
          itens: { include: { produto: true } },
          fretes: { orderBy: { id: "asc" }, take: 3 },
        },
        orderBy: { dataVenda: "desc" },
        take,
        skip,
      }),
      prisma.venda.count({ where }),
      prisma.venda.groupBy({
        by: ["vendedorId"],
        where,
        _sum: { valorTotal: true, frete: true },
        _count: { id: true },
      }),
      prisma.venda.groupBy({
        by: ["clienteId"],
        where,
        _sum: { valorTotal: true },
        _count: { id: true },
      }),
      prisma.itemVenda.groupBy({
        by: ["produtoId"],
        where: { venda: where },
        _sum: { quantidade: true, subtotal: true },
        _count: { id: true },
      }),
    ]);

    const totalFaturamento = parseFloat(totaisAgg._sum.valorTotal || 0);
    const totalFrete = parseFloat(totaisAgg._sum.frete || 0);
    const totalQuantidade = vendas.reduce(
      (acc, v) =>
        acc + v.itens.reduce((a, i) => a + parseFloat(i.quantidade), 0),
      0,
    );

    const vendedorIds = porVendedorAgg.map((x) => x.vendedorId).filter(Boolean);
    const clienteIds = porClienteAgg.map((x) => x.clienteId).filter(Boolean);
    const produtoIds = porProdutoAgg.map((x) => x.produtoId).filter(Boolean);

    const [vendedores, clientes, produtos] = await Promise.all([
      vendedorIds.length
        ? prisma.vendedor.findMany({
            where: { tenantId: req.tenantId, id: { in: vendedorIds } },
            select: { id: true, nome: true, comissaoPercentual: true },
          })
        : [],
      clienteIds.length
        ? prisma.cliente.findMany({
            where: { tenantId: req.tenantId, id: { in: clienteIds } },
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          })
        : [],
      produtoIds.length
        ? prisma.produto.findMany({
            where: { tenantId: req.tenantId, id: { in: produtoIds } },
            select: { id: true, nome: true, unidade: true },
          })
        : [],
    ]);

    const vendedorMap = new Map(vendedores.map((x) => [x.id, x]));
    const clienteMap = new Map(clientes.map((x) => [x.id, x]));
    const produtoMap = new Map(produtos.map((x) => [x.id, x]));

    const resumoRepresentantes = porVendedorAgg
      .map((x) => {
        const vendedor = vendedorMap.get(x.vendedorId);
        const faturamento = parseFloat(x._sum?.valorTotal || 0);
        const frete = parseFloat(x._sum?.frete || 0);
        const quantidadeVendas = x._count?.id || 0;
        return {
          vendedorId: x.vendedorId,
          vendedorNome: vendedor?.nome || `Vendedor #${x.vendedorId}`,
          comissaoPercentual: parseFloat(vendedor?.comissaoPercentual || 0),
          faturamento,
          frete,
          quantidadeVendas,
          ticketMedio: quantidadeVendas > 0 ? faturamento / quantidadeVendas : 0,
          participacao: totalFaturamento > 0 ? (faturamento / totalFaturamento) * 100 : 0,
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento);

    const resumoClientes = porClienteAgg
      .map((x) => {
        const cliente = clienteMap.get(x.clienteId);
        const faturamento = parseFloat(x._sum?.valorTotal || 0);
        const quantidadeVendas = x._count?.id || 0;
        return {
          clienteId: x.clienteId,
          clienteNome:
            cliente?.nomeFantasia?.trim() || cliente?.razaoSocial || `Cliente #${x.clienteId}`,
          faturamento,
          quantidadeVendas,
          ticketMedio: quantidadeVendas > 0 ? faturamento / quantidadeVendas : 0,
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento);

    const resumoProdutos = porProdutoAgg
      .map((x) => {
        const produto = produtoMap.get(x.produtoId);
        return {
          produtoId: x.produtoId,
          produtoNome: produto?.nome || `Produto #${x.produtoId}`,
          unidade: produto?.unidade || "",
          quantidade: parseFloat(x._sum?.quantidade || 0),
          faturamento: parseFloat(x._sum?.subtotal || 0),
          quantidadeItens: x._count?.id || 0,
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento);

    setPaginationHeaders(res, { total, take, skip });
    res.json({
      vendas,
      totalFaturamento,
      totalFrete,
      totalQuantidade,
      quantidade: vendas.length,
      totalRegistros: total,
      resumoRepresentantes,
      resumoClientes,
      resumoProdutos,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/relatorios/vendas/export-async
router.post("/vendas/export-async", async (req, res) => {
  try {
    const payload = {
      tenantId: String(req.tenantId),
      dataInicio: req.body?.dataInicio ? String(req.body.dataInicio) : "",
      dataFim: req.body?.dataFim ? String(req.body.dataFim) : "",
      busca: req.body?.busca ? String(req.body.busca) : "",
      vendedorId: req.body?.vendedorId ? String(req.body.vendedorId) : "",
      clienteId: req.body?.clienteId ? String(req.body.clienteId) : "",
      produtoId: req.body?.produtoId ? String(req.body.produtoId) : "",
    };
    const jobId = createExportJob("vendas_csv", req.tenantId, payload);
    res.status(202).json({ jobId, status: "pending" });

    setImmediate(async () => {
      try {
        markRunning(jobId);
        const where = buildVendasWhere(payload, parseInt(payload.tenantId, 10));
        const vendas = await prisma.venda.findMany({
          where,
          include: {
            cliente: { select: { nomeFantasia: true, razaoSocial: true } },
            vendedor: { select: { nome: true } },
          },
          orderBy: { dataVenda: "desc" },
          take: 50000,
        });

        const header = "Data,Cliente,Vendedor,Valor Total,Frete\n";
        const rows = vendas
          .map((v) =>
            [
              new Date(v.dataVenda).toLocaleDateString("pt-BR"),
              String(v.cliente.nomeFantasia || v.cliente.razaoSocial || "").replaceAll('"', '""'),
              String(v.vendedor.nome || "").replaceAll('"', '""'),
              parseFloat(String(v.valorTotal || 0)).toFixed(2),
              parseFloat(String(v.frete || 0)).toFixed(2),
            ]
              .map((x) => `"${x}"`)
              .join(","),
          )
          .join("\n");

        const periodoIni = payload.dataInicio || "inicio";
        const periodoFim = payload.dataFim || "fim";
        markCompleted(jobId, {
          mimeType: "text/csv;charset=utf-8;",
          filename: `relatorio-vendas-${periodoIni}-${periodoFim}.csv`,
          content: "\uFEFF" + header + rows,
          totalLinhas: vendas.length,
        });
      } catch (error) {
        markFailed(jobId, error);
      }
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/comissoes
// modo=emissao | caixa — emissao: comissão na venda; caixa: proporcional ao recebido na ordem
router.get("/comissoes", async (req, res) => {
  try {
    const { dataInicio, dataFim, vendedorId, modo: modoQ } = req.query;
    const stored = await getConfig(prisma, req.tenantId, "COMISSAO_MODO");
    const modo =
      modoQ === "caixa" || modoQ === "emissao"
        ? modoQ
        : stored === "caixa"
          ? "caixa"
          : "emissao";

    const where = { tenantId: req.tenantId, ativo: true };
    if (vendedorId) where.id = parseInt(vendedorId, 10);
    const vendedores = await prisma.vendedor.findMany({
      where,
    });

    const vendedorIds = vendedores.map((v) => v.id);
    const vendaWhere = { tenantId: req.tenantId, vendedorId: { in: vendedorIds } };
    if (dataInicio || dataFim) {
      vendaWhere.dataVenda = getDateRange(dataInicio, dataFim);
    }
    const vendas = await prisma.venda.findMany({
      where: vendaWhere,
      select: {
        id: true,
        numeroVenda: true,
        vendedorId: true,
        valorTotal: true,
        comissaoValor: true,
        comissaoPercentualAplicado: true,
        dataVenda: true,
        cliente: true,
        itens: { include: { produto: true } },
        comissaoAjuste: { select: { ajusteValor: true, motivo: true } },
      },
      orderBy: { dataVenda: "desc" },
    });

    const vendaIds = vendas.map((x) => x.id);
    const pagamentos =
      vendaIds.length === 0
        ? []
        : await prisma.pagamento.findMany({
            where: { tenantId: req.tenantId, vendaId: { in: vendaIds } },
            select: { vendaId: true, valor: true, data: true, tipo: true },
          });
    const pagByVenda = new Map();
    for (const p of pagamentos) {
      if (!p.vendaId) continue;
      if (!pagByVenda.has(p.vendaId)) pagByVenda.set(p.vendaId, []);
      pagByVenda.get(p.vendaId).push(p);
    }

    const vendedorById = new Map(vendedores.map((x) => [x.id, x]));

    const vendaParaCalculo = (venda) => {
      const vProv = vendedorById.get(venda.vendedorId);
      const pctVenda = parseFloat(String(venda.comissaoPercentualAplicado ?? 0));
      const valGravado = parseFloat(String(venda.comissaoValor ?? 0));
      const pctCadastro = vProv
        ? parseFloat(String(vProv.comissaoPercentual ?? 0))
        : 0;
      if (valGravado > 0 || pctVenda > 0) return venda;
      if (pctCadastro > 0) {
        return { ...venda, comissaoPercentualAplicado: pctCadastro };
      }
      return venda;
    };

    const vendasByVendedor = new Map();
    for (const venda of vendas) {
      const key = venda.vendedorId;
      if (!vendasByVendedor.has(key)) vendasByVendedor.set(key, []);
      const lista = vendasByVendedor.get(key);
      const pags = pagByVenda.get(venda.id) || [];
      const vCalc = vendaParaCalculo(venda);
      const comissaoLinha =
        modo === "caixa"
          ? comissaoPorCaixa(vCalc, pags)
          : comissaoPorEmissao(vCalc);
      lista.push({
        ...venda,
        ajusteComissaoValor: parseFloat(
          String(venda.comissaoAjuste?.ajusteValor ?? 0),
        ),
        ajusteComissaoMotivo: venda.comissaoAjuste?.motivo ?? null,
        comissaoCalculada: comissaoLinha,
        comissaoFinal:
          comissaoLinha + parseFloat(String(venda.comissaoAjuste?.ajusteValor ?? 0)),
        totalPagoNaVenda: pags.reduce(
          (a, x) => a + parseFloat(String(x.valor)),
          0,
        ),
      });
    }

    const resultado = vendedores.map((v) => {
      const vendasDoVendedor = vendasByVendedor.get(v.id) || [];
      const totalVendas = vendasDoVendedor.reduce(
        (acc, venda) => acc + parseFloat(String(venda.valorTotal)),
        0,
      );
      const comissao = vendasDoVendedor.reduce(
        (acc, venda) =>
          acc + parseFloat(String(venda.comissaoFinal ?? venda.comissaoCalculada ?? 0)),
        0,
      );
      const percentualMedio =
        totalVendas > 0
          ? (comissao / totalVendas) * 100
          : parseFloat(v.comissaoPercentual);
      return {
        vendedor: v,
        vendas: vendasDoVendedor,
        totalVendas,
        comissao,
        percentual: percentualMedio,
        quantidadeVendas: vendasDoVendedor.length,
      };
    });

    res.json({ modo, resultado });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/relatorios/comissoes/ajustes-lote
router.post("/comissoes/ajustes-lote", async (req, res) => {
  try {
    const ajustes = Array.isArray(req.body?.ajustes) ? req.body.ajustes : [];
    if (!ajustes.length) {
      return res.status(400).json({ error: "Nenhum ajuste informado" });
    }
    const ids = ajustes
      .map((a) => parseInt(String(a?.vendaId || 0), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) {
      return res.status(400).json({ error: "vendaId inválido no lote" });
    }
    const vendaIdsSolicitados = new Set(ids);

    const vendasDoTenant = await prisma.venda.findMany({
      where: { tenantId: req.tenantId, id: { in: [...vendaIdsSolicitados] } },
      select: { id: true },
    });
    if (vendasDoTenant.length !== vendaIdsSolicitados.size) {
      return res.status(400).json({
        error: "Uma ou mais vendas não existem ou não pertencem ao seu ambiente",
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of ajustes) {
        const vendaId = parseInt(String(item?.vendaId || 0), 10);
        if (!Number.isFinite(vendaId) || vendaId <= 0) continue;
        const ajusteValor = parseFloat(String(item?.ajusteValor ?? 0));
        const motivo =
          item?.motivo == null ? null : String(item.motivo).trim().slice(0, 500);
        await tx.comissaoAjusteVenda.upsert({
          where: { vendaId },
          update: { ajusteValor: Number.isFinite(ajusteValor) ? ajusteValor : 0, motivo },
          create: {
            tenantId: req.tenantId,
            vendaId,
            ajusteValor: Number.isFinite(ajusteValor) ? ajusteValor : 0,
            motivo,
          },
        });
      }
    });

    res.json({ success: true, total: ids.length });
  } catch (error) {
    handleRouteError(res, error);
  }
});

function sumDecimal(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// GET /api/relatorios/financeiro
router.get("/financeiro", async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });

    const [clientes, titulosAgg] = await Promise.all([
      prisma.cliente.findMany({ where: { tenantId: req.tenantId, ativo: true } }),
      prisma.tituloReceber.groupBy({
        by: ["clienteId"],
        where: { tenantId: req.tenantId },
        _sum: { valorOriginal: true, valorPago: true },
      }),
    ]);

    const aggMap = new Map(
      titulosAgg.map((a) => [
        a.clienteId,
        {
          debito: parseFloat(a._sum.valorOriginal || 0),
          credito: parseFloat(a._sum.valorPago || 0),
        },
      ]),
    );

    const contasClientes = clientes.map((c) => {
      const agg = aggMap.get(c.id) || { debito: 0, credito: 0 };
      const saldo = Math.max(0, agg.debito - agg.credito);
      return { cliente: c, debito: agg.debito, credito: agg.credito, saldo };
    });

    const clientesDevedores = contasClientes
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);
    const totalEmAberto = clientesDevedores.reduce((acc, c) => acc + c.saldo, 0);
    const clientesDevedoresCount = clientesDevedores.length;
    const clientesDevedoresPage = clientesDevedores.slice(skip, skip + take);

    setPaginationHeaders(res, { total: clientesDevedoresCount, take, skip });

    res.json({
      contasClientes,
      clientesDevedores: clientesDevedoresPage,
      clientesDevedoresCount,
      totalEmAberto,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/relatorios/financeiro/export-async
router.post("/financeiro/export-async", async (req, res) => {
  try {
    const tenantSnap = req.tenantId;
    const jobId = createExportJob("financeiro_csv", tenantSnap, {
      tenantId: String(tenantSnap),
    });
    res.status(202).json({ jobId, status: "pending" });

    setImmediate(async () => {
      try {
        markRunning(jobId);
        const tenantId = tenantSnap;
        const [clientes, titulosAgg] = await Promise.all([
          prisma.cliente.findMany({ where: { tenantId, ativo: true } }),
          prisma.tituloReceber.groupBy({
            by: ["clienteId"],
            where: { tenantId },
            _sum: { valorOriginal: true, valorPago: true },
          }),
        ]);

        const aggMap = new Map(
          titulosAgg.map((a) => [
            a.clienteId,
            {
              debito: parseFloat(String(a._sum.valorOriginal || 0)),
              credito: parseFloat(String(a._sum.valorPago || 0)),
            },
          ]),
        );

        const clientesDevedores = clientes
          .map((c) => {
            const agg = aggMap.get(c.id) || { debito: 0, credito: 0 };
            const saldo = Math.max(0, agg.debito - agg.credito);
            return { cliente: c, debito: agg.debito, credito: agg.credito, saldo };
          })
          .filter((c) => c.saldo > 0)
          .sort((a, b) => b.saldo - a.saldo);

        const totalLinhas = clientesDevedores.length;
        const csv =
          "Cliente,Debitos,Pagamentos,Em aberto\n" +
          clientesDevedores
            .map(
              (c) =>
                `"${String(c.cliente.nomeFantasia || c.cliente.razaoSocial).replaceAll('"', '""')}",${c.debito.toFixed(2)},${c.credito.toFixed(2)},${c.saldo.toFixed(2)}`,
            )
            .join("\n");

        markCompleted(jobId, {
          mimeType: "text/csv;charset=utf-8;",
          filename: `financeiro-devedores_${new Date().toISOString().slice(0, 10)}.csv`,
          content: "\uFEFF" + csv,
          totalLinhas,
        });
      } catch (error) {
        markFailed(jobId, error);
      }
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/titulos
router.get("/titulos", async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = buildTitulosWhere(req.query, req.tenantId);

    const [titulos, totalTitulosCount, aggTotais] = await Promise.all([
      prisma.tituloReceber.findMany({
        where,
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          venda: { select: { id: true, numeroVenda: true, dataVenda: true, valorTotal: true } },
        },
        orderBy: [{ vencimento: "asc" }, { id: "desc" }],
        take,
        skip,
      }),
      prisma.tituloReceber.count({ where }),
      prisma.tituloReceber.aggregate({
        where,
        _sum: { valorOriginal: true, valorPago: true },
      }),
    ]);

    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    const addDays = (base, days) => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d;
    };

    const sumAberto = async (extraWhere = {}) => {
      const agg = await prisma.tituloReceber.aggregate({
        where: {
          ...where,
          ...extraWhere,
          status: { in: ["aberto", "parcial"] },
        },
        _sum: { valorOriginal: true, valorPago: true },
      });
      const original = parseFloat(String(agg._sum.valorOriginal || 0));
      const pago = parseFloat(String(agg._sum.valorPago || 0));
      return Math.max(0, original - pago);
    };

    const [vencidos, ate30, de31a60, de61a90, acima90] = await Promise.all([
      sumAberto({ vencimento: { lt: hoje } }),
      sumAberto({ vencimento: { gte: hoje, lte: addDays(hoje, 30) } }),
      sumAberto({ vencimento: { gt: addDays(hoje, 30), lte: addDays(hoje, 60) } }),
      sumAberto({ vencimento: { gt: addDays(hoje, 60), lte: addDays(hoje, 90) } }),
      sumAberto({ vencimento: { gt: addDays(hoje, 90) } }),
    ]);

    const resumo = {
      totalTitulos: totalTitulosCount,
      valorOriginal: parseFloat(String(aggTotais._sum.valorOriginal || 0)),
      valorPago: parseFloat(String(aggTotais._sum.valorPago || 0)),
      valorEmAberto: Math.max(
        0,
        parseFloat(String(aggTotais._sum.valorOriginal || 0)) -
          parseFloat(String(aggTotais._sum.valorPago || 0)),
      ),
      faixas: {
        vencidos,
        ate30,
        de31a60,
        de61a90,
        acima90,
      },
    };

    setPaginationHeaders(res, { total: totalTitulosCount, take, skip });
    res.json({ titulos, resumo });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/relatorios/titulos/export-async
router.post("/titulos/export-async", async (req, res) => {
  try {
    const raw = req.body || {};
    const payload = {
      tenantId: String(req.tenantId),
      clienteId: raw.clienteId ? String(raw.clienteId) : "",
      vendaId: raw.vendaId ? String(raw.vendaId) : "",
      status: raw.status ? String(raw.status) : "",
      dataVencInicio: raw.dataVencInicio ? String(raw.dataVencInicio) : "",
      dataVencFim: raw.dataVencFim ? String(raw.dataVencFim) : "",
      somenteEmAberto: raw.somenteEmAberto ? "true" : "false",
    };

    const jobId = createExportJob("titulos_csv", req.tenantId, payload);
    res.status(202).json({ jobId, status: "pending" });

    setImmediate(async () => {
      try {
        markRunning(jobId);
        const where = buildTitulosWhere(payload, parseInt(payload.tenantId, 10));
        const titulos = await prisma.tituloReceber.findMany({
          where,
          include: {
            cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
            venda: { select: { id: true, numeroVenda: true, dataVenda: true, valorTotal: true } },
          },
          orderBy: [{ vencimento: "asc" }, { id: "desc" }],
        });

        const header =
          "Título,Cliente,Venda,Vencimento,Valor Original,Valor Pago,Valor em Aberto,Status";
        const body = titulos
          .map((t) => {
            const original = parseFloat(String(t.valorOriginal || 0));
            const pago = parseFloat(String(t.valorPago || 0));
            const aberto = Math.max(0, original - pago);
            const cols = [
              t.numero || `#${t.id}`,
              t.cliente.nomeFantasia || t.cliente.razaoSocial,
              t.venda ? `Venda #${t.venda.numeroVenda ?? t.venda.id}` : "-",
              new Date(t.vencimento).toLocaleDateString("pt-BR"),
              original.toFixed(2),
              pago.toFixed(2),
              aberto.toFixed(2),
              t.status,
            ];
            return cols.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
          })
          .join("\n");

        markCompleted(jobId, {
          mimeType: "text/csv;charset=utf-8;",
          filename: `titulos_${new Date().toISOString().slice(0, 10)}.csv`,
          content: "\uFEFF" + header + "\n" + body,
          totalLinhas: titulos.length,
        });
      } catch (error) {
        markFailed(jobId, error);
      }
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/exports/:jobId
router.get("/exports/:jobId", async (req, res) => {
  try {
    const job = getExportJob(req.params.jobId);
    if (!job || !exportJobBelongsToTenant(job, req.tenantId)) {
      return res.status(404).json({ error: "Job não encontrado" });
    }
    res.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      error: job.error,
      totalLinhas: job.result?.totalLinhas ?? null,
      downloadUrl:
        job.status === "completed"
          ? `/api/relatorios/exports/${job.id}/download`
          : null,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/exports/:jobId/download
router.get("/exports/:jobId/download", async (req, res) => {
  try {
    const job = getExportJob(req.params.jobId);
    if (!job || !exportJobBelongsToTenant(job, req.tenantId)) {
      return res.status(404).json({ error: "Job não encontrado" });
    }
    if (job.status !== "completed" || !job.result?.content) {
      return res.status(409).json({ error: "Exportação ainda não concluída" });
    }
    res.setHeader("content-type", job.result.mimeType);
    res.setHeader(
      "content-disposition",
      `attachment; filename="${job.result.filename || "export.csv"}"`,
    );
    res.send(job.result.content);
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
