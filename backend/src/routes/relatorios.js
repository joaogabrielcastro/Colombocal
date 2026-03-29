const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { handleRouteError, parsePagination, setPaginationHeaders } = require("../utils/api");
const { getConfig } = require("../services/configSistema");
const {
  comissaoPorEmissao,
  comissaoPorCaixa,
} = require("../services/comissao");

const prisma = new PrismaClient();

function getDateRange(dataInicio, dataFim) {
  const where = {};
  if (dataInicio) where.gte = new Date(dataInicio);
  if (dataFim) {
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);
    where.lte = fim;
  }
  return where;
}

// GET /api/relatorios/vendas
router.get("/vendas", async (req, res) => {
  try {
    const { dataInicio, dataFim, clienteId, vendedorId, produtoId } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 1000,
    });
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    if (vendedorId) where.vendedorId = parseInt(vendedorId);
    if (dataInicio || dataFim)
      where.dataVenda = getDateRange(dataInicio, dataFim);
    if (produtoId) {
      where.itens = { some: { produtoId: parseInt(produtoId, 10) } };
    }

    const aggWhere = { ...where };
    const [totaisAgg, vendas, total] = await Promise.all([
      prisma.venda.aggregate({
        where: aggWhere,
        _sum: { valorTotal: true },
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
    ]);

    const totalFaturamento = parseFloat(totaisAgg._sum.valorTotal || 0);
    const totalQuantidade = vendas.reduce(
      (acc, v) =>
        acc + v.itens.reduce((a, i) => a + parseFloat(i.quantidade), 0),
      0,
    );

    setPaginationHeaders(res, { total, take, skip });
    res.json({
      vendas,
      totalFaturamento,
      totalQuantidade,
      quantidade: vendas.length,
      totalRegistros: total,
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
    const stored = await getConfig(prisma, "COMISSAO_MODO");
    const modo =
      modoQ === "caixa" || modoQ === "emissao"
        ? modoQ
        : stored === "caixa"
          ? "caixa"
          : "emissao";

    const where = { ativo: true };
    if (vendedorId) where.id = parseInt(vendedorId);
    const vendedores = await prisma.vendedor.findMany({
      where,
    });

    const vendedorIds = vendedores.map((v) => v.id);
    const vendaWhere = { vendedorId: { in: vendedorIds } };
    if (dataInicio || dataFim) {
      vendaWhere.dataVenda = getDateRange(dataInicio, dataFim);
    }
    const vendas = await prisma.venda.findMany({
      where: vendaWhere,
      select: {
        id: true,
        vendedorId: true,
        valorTotal: true,
        comissaoValor: true,
        comissaoPercentualAplicado: true,
        dataVenda: true,
        cliente: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataVenda: "desc" },
    });

    const vendaIds = vendas.map((x) => x.id);
    const pagamentos =
      vendaIds.length === 0
        ? []
        : await prisma.pagamento.findMany({
            where: { vendaId: { in: vendaIds } },
            select: { vendaId: true, valor: true, data: true, tipo: true },
          });
    const pagByVenda = new Map();
    for (const p of pagamentos) {
      if (!p.vendaId) continue;
      if (!pagByVenda.has(p.vendaId)) pagByVenda.set(p.vendaId, []);
      pagByVenda.get(p.vendaId).push(p);
    }

    const vendasByVendedor = new Map();
    for (const venda of vendas) {
      const key = venda.vendedorId;
      if (!vendasByVendedor.has(key)) vendasByVendedor.set(key, []);
      const lista = vendasByVendedor.get(key);
      const pags = pagByVenda.get(venda.id) || [];
      const comissaoLinha =
        modo === "caixa"
          ? comissaoPorCaixa(venda, pags)
          : comissaoPorEmissao(venda);
      lista.push({
        ...venda,
        comissaoCalculada: comissaoLinha,
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
        (acc, venda) => acc + parseFloat(String(venda.comissaoCalculada || 0)),
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

// GET /api/relatorios/faturamento
router.get("/faturamento", async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const vendaWhere = {};
    if (dataInicio || dataFim)
      vendaWhere.dataVenda = getDateRange(dataInicio, dataFim);

    const vendas = await prisma.venda.findMany({
      where: vendaWhere,
      include: { cliente: true, itens: { include: { produto: true } } },
      orderBy: { dataVenda: "asc" },
    });

    // Por cliente
    const porCliente = {};
    for (const v of vendas) {
      const key = v.clienteId;
      if (!porCliente[key]) {
        porCliente[key] = { cliente: v.cliente, total: 0, quantidadeVendas: 0 };
      }
      porCliente[key].total += parseFloat(v.valorTotal);
      porCliente[key].quantidadeVendas++;
    }

    // Por produto
    const porProduto = {};
    for (const v of vendas) {
      for (const item of v.itens) {
        const key = item.produtoId;
        if (!porProduto[key]) {
          porProduto[key] = { produto: item.produto, total: 0, quantidade: 0 };
        }
        porProduto[key].total += parseFloat(item.subtotal);
        porProduto[key].quantidade += parseFloat(item.quantidade);
      }
    }

    // Por mês
    const porMes = {};
    for (const v of vendas) {
      const mes = `${v.dataVenda.getFullYear()}-${String(v.dataVenda.getMonth() + 1).padStart(2, "0")}`;
      if (!porMes[mes]) porMes[mes] = { mes, total: 0, quantidadeVendas: 0 };
      porMes[mes].total += parseFloat(v.valorTotal);
      porMes[mes].quantidadeVendas++;
    }

    const totalGeral = vendas.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );

    res.json({
      totalGeral,
      quantidadeVendas: vendas.length,
      porCliente: Object.values(porCliente).sort((a, b) => b.total - a.total),
      porProduto: Object.values(porProduto).sort((a, b) => b.total - a.total),
      porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/financeiro
router.get("/financeiro", async (req, res) => {
  try {
    // Todos clientes ativos com suas contas (baseado em títulos)
    const [clientes, titulosAgg, chequesPorStatus, chequesPendentes, chequesDevolvidos] =
      await Promise.all([
        prisma.cliente.findMany({ where: { ativo: true } }),
        prisma.tituloReceber.groupBy({
          by: ["clienteId"],
          _sum: { valorOriginal: true, valorPago: true },
        }),
        prisma.cheque.groupBy({
          by: ["status"],
          _sum: { valor: true },
          _count: { id: true },
        }),
        prisma.cheque.findMany({
          where: { status: { in: ["a_receber", "recebido"] } },
          include: { cliente: true },
          orderBy: { dataRecebimento: "asc" },
        }),
        prisma.cheque.findMany({
          where: { status: "devolvido" },
          include: { cliente: true },
          orderBy: { dataRecebimento: "desc" },
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
      const saldo = agg.credito - agg.debito; // negativo = em aberto
      return { cliente: c, debito: agg.debito, credito: agg.credito, saldo };
    });

    const clientesDevedores = contasClientes
      .filter((c) => c.saldo < 0)
      .sort((a, b) => a.saldo - b.saldo);
    const totalEmAberto = Math.abs(
      clientesDevedores.reduce((acc, c) => acc + c.saldo, 0),
    );

    res.json({
      contasClientes,
      clientesDevedores,
      totalEmAberto,
      chequesPorStatus,
      chequesPendentes,
      chequesDevolvidos,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/titulos
router.get("/titulos", async (req, res) => {
  try {
    const {
      clienteId,
      status,
      dataVencInicio,
      dataVencFim,
      somenteEmAberto,
      vendaId,
    } = req.query;

    const where = {};
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

    const titulos = await prisma.tituloReceber.findMany({
      where,
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        venda: { select: { id: true, dataVenda: true, valorTotal: true } },
      },
      orderBy: [{ vencimento: "asc" }, { id: "desc" }],
    });

    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    const addDays = (base, days) => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d;
    };

    const resumo = {
      totalTitulos: titulos.length,
      valorOriginal: 0,
      valorPago: 0,
      valorEmAberto: 0,
      faixas: {
        vencidos: 0,
        ate30: 0,
        de31a60: 0,
        de61a90: 0,
        acima90: 0,
      },
    };

    for (const t of titulos) {
      const original = parseFloat(t.valorOriginal);
      const pago = parseFloat(t.valorPago);
      const aberto = Math.max(0, original - pago);
      resumo.valorOriginal += original;
      resumo.valorPago += pago;
      resumo.valorEmAberto += aberto;
      if (aberto <= 0.009) continue;

      const venc = new Date(t.vencimento);
      if (venc < hoje) {
        resumo.faixas.vencidos += aberto;
      } else if (venc <= addDays(hoje, 30)) {
        resumo.faixas.ate30 += aberto;
      } else if (venc <= addDays(hoje, 60)) {
        resumo.faixas.de31a60 += aberto;
      } else if (venc <= addDays(hoje, 90)) {
        resumo.faixas.de61a90 += aberto;
      } else {
        resumo.faixas.acima90 += aberto;
      }
    }

    res.json({ titulos, resumo });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/relatorios/eventos-financeiros
router.get("/eventos-financeiros", async (req, res) => {
  try {
    const { tipo, clienteId, vendaId, dataInicio, dataFim } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });

    const where = {};
    if (tipo) where.tipo = tipo;
    if (clienteId) where.clienteId = parseInt(clienteId, 10);
    if (vendaId) where.vendaId = parseInt(vendaId, 10);
    if (dataInicio || dataFim) {
      where.createdAt = getDateRange(dataInicio, dataFim);
    }

    const [eventos, total] = await Promise.all([
      prisma.financeiroEvento.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.financeiroEvento.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });

    const resumoPorTipoRaw = await prisma.financeiroEvento.groupBy({
      by: ["tipo"],
      where,
      _count: { _all: true },
      _sum: { valor: true },
    });
    const resumoPorTipo = resumoPorTipoRaw
      .map((r) => ({
        tipo: r.tipo,
        quantidade: r._count._all,
        valorTotal: parseFloat(r._sum.valor || 0),
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    res.json({ eventos, resumoPorTipo, total });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
