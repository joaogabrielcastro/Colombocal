const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError, parsePagination, setPaginationHeaders } = require("../utils/api");
const { getConfig } = require("../services/configSistema");
const {
  enqueueExportJob,
  getExportJob,
  exportJobBelongsToTenant,
} = require("../services/exportJobs");
const { listarClientesDevedores } = require("../services/financeiroDevedores");
const { requireNavKey } = require("../middleware/navPermission");
const {
  comissaoPorEmissao,
  comissaoPorCaixa,
} = require("../services/comissao");
const { buildVendasWhere, buildTitulosWhere } = require("../utils/relatorioWhere");
const { getDateRange } = require("../utils/dateRangeQuery");
const { requestAllowsFrete } = require("../utils/tenantRequest");

/** Limite de linhas de venda no relatório de comissões (UI + memória). */
const COMISSOES_DEFAULT_TAKE = 500;
const COMISSOES_MAX_TAKE = 2000;

const relatorioNavByPrefix = [
  ["/vendas", "rel_vendas"],
  ["/comissoes", "rel_comissoes"],
  ["/financeiro", "rel_financeiro"],
  // Hub Contas a receber: visão por título usa a mesma permissão
  ["/titulos", "rel_financeiro"],
  ["/fretes", "rel_fretes"],
  ["/carregamento", "rel_carregamento"],
  ["/motoristas", "rel_motoristas"],
];

async function requireFreteRelatorio(req, res, next) {
  try {
    if (!(await requestAllowsFrete(req))) {
      return res.status(403).json({ error: "Relatório indisponível para esta organização" });
    }
    next();
  } catch (e) {
    next(e);
  }
}

router.use((req, res, next) => {
  if (req.path.startsWith("/exports/")) return next();
  const match = relatorioNavByPrefix.find(
    ([prefix]) => req.path === prefix || req.path.startsWith(`${prefix}/`),
  );
  if (!match) return next();
  return requireNavKey(match[1])(req, res, next);
});

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
    const jobId = await enqueueExportJob("vendas_csv", req.tenantId, payload);
    res.status(202).json({ jobId, status: "pending" });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/comissoes
// modo=emissao | caixa — emissao: comissão na venda; caixa: proporcional ao recebido na ordem
// Paginação por vendas do período (take/skip) para limitar memória.
router.get("/comissoes", async (req, res) => {
  try {
    const { dataInicio, dataFim, vendedorId, modo: modoQ } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: COMISSOES_DEFAULT_TAKE,
      maxTake: COMISSOES_MAX_TAKE,
    });
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

    const [totalVendasPeriodo, vendas] = await Promise.all([
      prisma.venda.count({ where: vendaWhere }),
      prisma.venda.findMany({
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
        orderBy: [{ dataVenda: "desc" }, { id: "desc" }],
        take,
        skip,
      }),
    ]);

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

    setPaginationHeaders(res, { total: totalVendasPeriodo, take, skip });
    res.json({
      modo,
      resultado,
      totalVendasPeriodo,
      truncated: totalVendasPeriodo > take + skip,
      take,
      skip,
    });
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

// GET /api/relatorios/financeiro
router.get("/financeiro", async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });

    const {
      clientesDevedores: clientesDevedoresPage,
      clientesDevedoresCount,
      totalEmAberto,
    } = await listarClientesDevedores(req.tenantId, {
      take,
      skip,
      busca: req.query.busca ? String(req.query.busca) : "",
    });

    setPaginationHeaders(res, { total: clientesDevedoresCount, take, skip });

    res.json({
      // compat: antes vinha a lista completa; FE usa só a página de devedores
      contasClientes: clientesDevedoresPage,
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
    const jobId = await enqueueExportJob("financeiro_csv", tenantSnap, {
      tenantId: String(tenantSnap),
    });
    res.status(202).json({ jobId, status: "pending" });
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

    const jobId = await enqueueExportJob("titulos_csv", req.tenantId, payload);
    res.status(202).json({ jobId, status: "pending" });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/fretes
router.get("/fretes", requireFreteRelatorio, async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 500,
      maxTake: 1000,
    });
    const where = { tenantId: req.tenantId };
    const range = getDateRange(req.query.dataInicio, req.query.dataFim);
    if (Object.keys(range).length) where.data = range;
    if (req.query.clienteId) {
      const cid = parseInt(String(req.query.clienteId), 10);
      if (Number.isFinite(cid) && cid > 0) where.clienteId = cid;
    }
    if (req.query.avulso === "true") where.vendaId = null;
    if (req.query.avulso === "false") where.vendaId = { not: null };
    if (req.query.reciboEmitido === "true") where.reciboEmitido = true;
    if (req.query.reciboEmitido === "false") where.reciboEmitido = false;
    if (req.query.cliente && String(req.query.cliente).trim()) {
      const term = String(req.query.cliente).trim();
      where.cliente = {
        OR: [
          { nomeFantasia: { contains: term, mode: "insensitive" } },
          { razaoSocial: { contains: term, mode: "insensitive" } },
          { cnpj: { contains: term } },
          { cpf: { contains: term } },
        ],
      };
    }

    const [agg, comReciboAgg, fretes, totalRegistros, porClienteAgg] = await Promise.all([
      prisma.freteMovimento.aggregate({
        where,
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.freteMovimento.aggregate({
        where: { ...where, reciboEmitido: true },
        _sum: { valor: true },
        _count: { id: true },
      }),
      prisma.freteMovimento.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          },
          venda: {
            select: {
              id: true,
              numeroVenda: true,
              motorista: { select: { id: true, nome: true, placa: true } },
            },
          },
        },
        orderBy: [{ data: "desc" }, { id: "desc" }],
        take,
        skip,
      }),
      prisma.freteMovimento.count({ where }),
      prisma.freteMovimento.groupBy({
        by: ["clienteId"],
        where,
        _sum: { valor: true },
        _count: { id: true },
      }),
    ]);

    const clienteIds = porClienteAgg.map((x) => x.clienteId).filter(Boolean);
    const clientes = clienteIds.length
      ? await prisma.cliente.findMany({
          where: { tenantId: req.tenantId, id: { in: clienteIds } },
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        })
      : [];
    const clienteById = new Map(clientes.map((c) => [c.id, c]));

    const totalValor = parseFloat(String(agg._sum.valor || 0));
    const totalComRecibo = parseFloat(String(comReciboAgg._sum.valor || 0));

    setPaginationHeaders(res, { total: totalRegistros, take, skip });
    res.json({
      totalRegistros,
      totalValor,
      quantidadeComRecibo: comReciboAgg._count.id || 0,
      totalComRecibo,
      quantidadeSemRecibo: Math.max(0, (agg._count.id || 0) - (comReciboAgg._count.id || 0)),
      totalSemRecibo: Math.max(0, totalValor - totalComRecibo),
      porCliente: porClienteAgg
        .map((row) => {
          const c = clienteById.get(row.clienteId);
          return {
            clienteId: row.clienteId,
            nome: c?.nomeFantasia || c?.razaoSocial || `Cliente #${row.clienteId}`,
            quantidade: row._count.id,
            total: parseFloat(String(row._sum.valor || 0)),
          };
        })
        .sort((a, b) => b.total - a.total),
      fretes: fretes.map((f) => ({
        id: f.id,
        data: f.data,
        valor: parseFloat(String(f.valor || 0)),
        reciboEmitido: !!f.reciboEmitido,
        reciboNumero: f.reciboNumero,
        observacao: f.observacao,
        cliente: f.cliente,
        venda: f.venda
          ? {
              id: f.venda.id,
              numeroVenda: f.venda.numeroVenda,
              motorista: f.venda.motorista,
            }
          : null,
        avulso: f.vendaId == null,
      })),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/carregamento
router.get("/carregamento", requireFreteRelatorio, async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 500,
      maxTake: 1000,
    });
    const where = { tenantId: req.tenantId };
    const range = getDateRange(req.query.dataInicio, req.query.dataFim);
    if (Object.keys(range).length) where.dataEmissao = range;
    if (req.query.motoristaId) {
      const mid = parseInt(String(req.query.motoristaId), 10);
      if (Number.isFinite(mid) && mid > 0) where.motoristaId = mid;
    }
    if (req.query.cliente && String(req.query.cliente).trim()) {
      const term = String(req.query.cliente).trim();
      where.clienteNome = { contains: term, mode: "insensitive" };
    }
    if (req.query.numeroOc != null && String(req.query.numeroOc).trim()) {
      const n = parseInt(String(req.query.numeroOc).replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > 0) where.numeroOc = n;
    }

    const [ordens, totalRegistros] = await Promise.all([
      prisma.ordemCarregamento.findMany({
        where,
        include: { itens: true },
        orderBy: [{ dataEmissao: "desc" }, { numeroOc: "desc" }],
        take,
        skip,
      }),
      prisma.ordemCarregamento.count({ where }),
    ]);

    const allForAgg = await prisma.ordemCarregamento.findMany({
      where,
      select: {
        id: true,
        clienteNome: true,
        motoristaId: true,
        motoristaNome: true,
        itens: { select: { quantidade: true } },
      },
    });

    const porClienteMap = new Map();
    const porMotoristaMap = new Map();
    let totalQuantidade = 0;
    for (const o of allForAgg) {
      const qtd = o.itens.reduce((a, i) => a + parseFloat(String(i.quantidade || 0)), 0);
      totalQuantidade += qtd;
      const cKey = o.clienteNome || "—";
      const cRow = porClienteMap.get(cKey) || { nome: cKey, quantidade: 0, totalItens: 0 };
      cRow.quantidade += 1;
      cRow.totalItens += qtd;
      porClienteMap.set(cKey, cRow);

      const mKey = o.motoristaId != null ? `id:${o.motoristaId}` : `nome:${o.motoristaNome || "Sem motorista"}`;
      const mRow = porMotoristaMap.get(mKey) || {
        motoristaId: o.motoristaId,
        nome: o.motoristaNome || "Sem motorista",
        quantidade: 0,
        totalItens: 0,
      };
      mRow.quantidade += 1;
      mRow.totalItens += qtd;
      porMotoristaMap.set(mKey, mRow);
    }

    setPaginationHeaders(res, { total: totalRegistros, take, skip });
    res.json({
      totalRegistros,
      totalQuantidade,
      porCliente: [...porClienteMap.values()].sort((a, b) => b.quantidade - a.quantidade),
      porMotorista: [...porMotoristaMap.values()].sort((a, b) => b.quantidade - a.quantidade),
      ordens: ordens.map((o) => {
        const totalItens = o.itens.reduce(
          (a, i) => a + parseFloat(String(i.quantidade || 0)),
          0,
        );
        return {
          id: o.id,
          numeroOc: o.numeroOc,
          dataEmissao: o.dataEmissao,
          pedido: o.pedido,
          clienteNome: o.clienteNome,
          clienteCidade: o.clienteCidade,
          clienteUf: o.clienteUf,
          motoristaNome: o.motoristaNome,
          motoristaPlaca: o.motoristaPlaca,
          vendaId: o.vendaId,
          totalItens,
          itens: o.itens.map((i) => ({
            descricao: i.descricao,
            quantidade: parseFloat(String(i.quantidade || 0)),
            unidade: i.unidade,
          })),
        };
      }),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/motoristas — desempenho no período (vendas + OC)
router.get("/motoristas", requireFreteRelatorio, async (req, res) => {
  try {
    const range = getDateRange(req.query.dataInicio, req.query.dataFim);
    const vendaWhere = {
      tenantId: req.tenantId,
      motoristaId: { not: null },
    };
    if (Object.keys(range).length) vendaWhere.dataVenda = range;

    const ocWhere = {
      tenantId: req.tenantId,
      motoristaId: { not: null },
    };
    if (Object.keys(range).length) ocWhere.dataEmissao = range;

    const [motoristas, vendasAgg, ocs] = await Promise.all([
      prisma.motorista.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { nome: "asc" },
      }),
      prisma.venda.groupBy({
        by: ["motoristaId"],
        where: vendaWhere,
        _sum: { valorTotal: true, frete: true },
        _count: { id: true },
      }),
      prisma.ordemCarregamento.findMany({
        where: ocWhere,
        select: {
          motoristaId: true,
          itens: { select: { quantidade: true } },
        },
      }),
    ]);

    const vendaByMot = new Map(
      vendasAgg
        .filter((x) => x.motoristaId != null)
        .map((x) => [
          x.motoristaId,
          {
            quantidade: x._count.id,
            valorProdutos: parseFloat(String(x._sum.valorTotal || 0)),
            frete: parseFloat(String(x._sum.frete || 0)),
          },
        ]),
    );

    const ocByMot = new Map();
    for (const o of ocs) {
      if (o.motoristaId == null) continue;
      const row = ocByMot.get(o.motoristaId) || { quantidade: 0, totalItens: 0 };
      row.quantidade += 1;
      row.totalItens += o.itens.reduce(
        (a, i) => a + parseFloat(String(i.quantidade || 0)),
        0,
      );
      ocByMot.set(o.motoristaId, row);
    }

    const lista = motoristas
      .map((m) => {
        const v = vendaByMot.get(m.id) || {
          quantidade: 0,
          valorProdutos: 0,
          frete: 0,
        };
        const c = ocByMot.get(m.id) || { quantidade: 0, totalItens: 0 };
        return {
          id: m.id,
          nome: m.nome,
          placa: m.placa,
          veiculo: m.veiculo,
          ativo: m.ativo,
          vendas: v,
          carregamentos: c,
        };
      })
      .filter((m) => {
        const temMovimento =
          m.vendas.quantidade > 0 || m.carregamentos.quantidade > 0;
        if (req.query.todos === "true") return m.ativo || temMovimento;
        return temMovimento;
      });

    const totais = lista.reduce(
      (acc, m) => {
        acc.vendas += m.vendas.quantidade;
        acc.valorProdutos += m.vendas.valorProdutos;
        acc.frete += m.vendas.frete;
        acc.carregamentos += m.carregamentos.quantidade;
        acc.itensCarregamento += m.carregamentos.totalItens;
        return acc;
      },
      {
        vendas: 0,
        valorProdutos: 0,
        frete: 0,
        carregamentos: 0,
        itensCarregamento: 0,
      },
    );

    res.json({
      totalMotoristas: lista.length,
      totais,
      motoristas: lista.sort(
        (a, b) =>
          b.vendas.quantidade +
          b.carregamentos.quantidade -
          (a.vendas.quantidade + a.carregamentos.quantidade),
      ),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/exports/:jobId
router.get("/exports/:jobId", async (req, res) => {
  try {
    const job = await getExportJob(req.params.jobId);
    if (!job || !exportJobBelongsToTenant(job, req.tenantId)) {
      return res.status(404).json({ error: "Job não encontrado" });
    }
    res.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      error: job.error,
      totalLinhas: job.result?.totalLinhas ?? null,
      truncated: job.result?.truncated ?? false,
      maxLinhas: job.result?.maxLinhas ?? null,
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
    const job = await getExportJob(req.params.jobId);
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
