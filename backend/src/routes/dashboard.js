const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

    // Vendas do dia
    const vendasHoje = await prisma.venda.findMany({
      where: { dataVenda: { gte: inicioDia, lte: fimDia } },
      include: { cliente: true },
    });
    const faturamentoHoje = vendasHoje.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );

    // Faturamento do mês
    const vendasMes = await prisma.venda.findMany({
      where: { dataVenda: { gte: inicioMes, lte: fimMes } },
    });
    const faturamentoMes = vendasMes.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );

    // Total de clientes com dívida
    const todosClientes = await prisma.cliente.findMany({
      where: { ativo: true },
    });
    const clientesDevendo = [];
    for (const c of todosClientes) {
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
      if (saldo < 0) clientesDevendo.push({ ...c, saldo });
    }

    // Cheques pendentes (recebido ou depositado)
    const chequesPendentes = await prisma.cheque.findMany({
      where: { status: { in: ["recebido", "depositado"] } },
      include: { cliente: true },
    });
    const totalChequesPendentes = chequesPendentes.reduce(
      (acc, c) => acc + parseFloat(c.valor),
      0,
    );

    // Produtos com estoque baixo
    const produtos = await prisma.produto.findMany({ where: { ativo: true } });
    const estoqueBaixo = produtos.filter(
      (p) => parseFloat(p.estoqueAtual) <= parseFloat(p.estoqueMinimo),
    );

    // Últimas 5 vendas
    const ultimasVendas = await prisma.venda.findMany({
      take: 5,
      orderBy: { dataVenda: "desc" },
      include: { cliente: true, vendedor: true },
    });

    // Faturamento dos últimos 6 meses
    const faturamentoMeses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const agg = await prisma.venda.aggregate({
        where: { dataVenda: { gte: inicio, lte: fim } },
        _sum: { valorTotal: true },
      });
      faturamentoMeses.push({
        mes: d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
        total: parseFloat(agg._sum.valorTotal || 0),
      });
    }

    res.json({
      vendasHoje: vendasHoje.length,
      faturamentoHoje,
      faturamentoMes,
      quantidadeVendasMes: vendasMes.length,
      clientesDevendo: clientesDevendo.length,
      totalEmAberto: Math.abs(
        clientesDevendo.reduce((acc, c) => acc + c.saldo, 0),
      ),
      chequesPendentes: chequesPendentes.length,
      totalChequesPendentes,
      estoqueBaixo: estoqueBaixo.length,
      produtosEstoqueBaixo: estoqueBaixo,
      ultimasVendas,
      faturamentoPorMes: faturamentoMeses,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
