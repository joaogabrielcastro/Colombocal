const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError, parsePagination, setPaginationHeaders } = require("../utils/api");
const { getConfig } = require("../services/configSistema");
const {
  comissaoPorEmissao,
  comissaoPorCaixa,
} = require("../services/comissao");


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

function sumDecimal(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeChequeStatusSlug(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function mapChequeGroupBy(rows) {
  const order = ["a_receber", "recebido", "depositado", "devolvido"];
  const merged = new Map();
  for (const row of rows) {
    const status = normalizeChequeStatusSlug(row.status);
    const count = row._count?.id ?? 0;
    const total = sumDecimal(row._sum?.valor);
    const cur = merged.get(status) || { status, count: 0, total: 0 };
    cur.count += count;
    cur.total += total;
    merged.set(status, cur);
  }
  return [...merged.values()].sort((a, b) => {
    const ia = order.indexOf(a.status);
    const ib = order.indexOf(b.status);
    const fa = ia === -1 ? 999 : ia;
    const fb = ib === -1 ? 999 : ib;
    return fa - fb || a.status.localeCompare(b.status);
  });
}

// GET /api/relatorios/financeiro
router.get("/financeiro", async (req, res) => {
  try {
    const chequePendenteWhere = {
      status: { in: ["a_receber", "recebido"] },
    };
    // Todos clientes ativos com suas contas (baseado em títulos)
    const [
      clientes,
      titulosAgg,
      chequesPorStatusRaw,
      chequesPendentesCount,
      chequesPendentesValorAgg,
      chequesPendentes,
      chequesDevolvidos,
    ] = await Promise.all([
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
      prisma.cheque.count({ where: chequePendenteWhere }),
      prisma.cheque.aggregate({
        where: chequePendenteWhere,
        _sum: { valor: true },
      }),
      prisma.cheque.findMany({
        where: chequePendenteWhere,
        take: 500,
        include: { cliente: true },
        orderBy: { dataRecebimento: "asc" },
      }),
      prisma.cheque.findMany({
        where: { status: "devolvido" },
        include: { cliente: true },
        orderBy: { dataRecebimento: "desc" },
      }),
    ]);

    const chequesPorStatus = mapChequeGroupBy(chequesPorStatusRaw);
    const chequesPendentesValorTotal = sumDecimal(
      chequesPendentesValorAgg._sum?.valor,
    );

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
      chequesPendentesCount: chequesPendentesCount,
      chequesPendentesValorTotal,
      chequesPendentesListaMax: 500,
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

module.exports = router;
