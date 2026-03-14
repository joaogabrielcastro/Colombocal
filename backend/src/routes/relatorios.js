const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
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
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    if (vendedorId) where.vendedorId = parseInt(vendedorId);
    if (dataInicio || dataFim)
      where.dataVenda = getDateRange(dataInicio, dataFim);

    const vendas = await prisma.venda.findMany({
      where,
      include: {
        cliente: true,
        vendedor: true,
        motorista: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataVenda: "desc" },
    });

    // Filtrar por produto se necessário
    const vendasFiltradas = produtoId
      ? vendas.filter((v) =>
          v.itens.some((i) => i.produtoId === parseInt(produtoId)),
        )
      : vendas;

    const totalFaturamento = vendasFiltradas.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );
    const totalQuantidade = vendasFiltradas.reduce(
      (acc, v) =>
        acc + v.itens.reduce((a, i) => a + parseFloat(i.quantidade), 0),
      0,
    );

    res.json({
      vendas: vendasFiltradas,
      totalFaturamento,
      totalQuantidade,
      quantidade: vendasFiltradas.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/relatorios/comissoes
router.get("/comissoes", async (req, res) => {
  try {
    const { dataInicio, dataFim, vendedorId } = req.query;
    const where = { ativo: true };
    if (vendedorId) where.id = parseInt(vendedorId);
    const vendedores = await prisma.vendedor.findMany({
      where,
    });

    const resultado = [];
    for (const v of vendedores) {
      const vendaWhere = { vendedorId: v.id };
      if (dataInicio || dataFim)
        vendaWhere.dataVenda = getDateRange(dataInicio, dataFim);

      const vendas = await prisma.venda.findMany({
        where: vendaWhere,
        include: { cliente: true, itens: { include: { produto: true } } },
        orderBy: { dataVenda: "desc" },
      });

      const totalVendas = vendas.reduce(
        (acc, venda) => acc + parseFloat(venda.valorTotal),
        0,
      );
      const comissao = totalVendas * (parseFloat(v.comissaoPercentual) / 100);

      resultado.push({
        vendedor: v,
        vendas,
        totalVendas,
        comissao,
        percentual: parseFloat(v.comissaoPercentual),
        quantidadeVendas: vendas.length,
      });
    }

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// GET /api/relatorios/financeiro
router.get("/financeiro", async (req, res) => {
  try {
    // Todos clientes ativos com suas contas
    const clientes = await prisma.cliente.findMany({ where: { ativo: true } });
    const contasClientes = [];

    for (const c of clientes) {
      const totalVendas = await prisma.venda.aggregate({
        where: { clienteId: c.id },
        _sum: { valorTotal: true },
      });
      const totalPagamentos = await prisma.pagamento.aggregate({
        where: { clienteId: c.id },
        _sum: { valor: true },
      });
      const debito = parseFloat(totalVendas._sum.valorTotal || 0);
      const credito = parseFloat(totalPagamentos._sum.valor || 0);
      const saldo = credito - debito;
      contasClientes.push({ cliente: c, debito, credito, saldo });
    }

    const clientesDevedores = contasClientes
      .filter((c) => c.saldo < 0)
      .sort((a, b) => a.saldo - b.saldo);
    const totalEmAberto = Math.abs(
      clientesDevedores.reduce((acc, c) => acc + c.saldo, 0),
    );

    // Cheques por status
    const chequesPorStatus = await prisma.cheque.groupBy({
      by: ["status"],
      _sum: { valor: true },
      _count: { id: true },
    });

    const chequesPendentes = await prisma.cheque.findMany({
      where: { status: { in: ["recebido", "depositado"] } },
      include: { cliente: true },
      orderBy: { dataRecebimento: "asc" },
    });

    const chequesDevolvidos = await prisma.cheque.findMany({
      where: { status: "devolvido" },
      include: { cliente: true },
      orderBy: { dataRecebimento: "desc" },
    });

    res.json({
      contasClientes,
      clientesDevedores,
      totalEmAberto,
      chequesPorStatus,
      chequesPendentes,
      chequesDevolvidos,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
