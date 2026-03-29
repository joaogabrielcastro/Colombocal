const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/estoque - listar movimentações (histórico; sem saldo em produto)
router.get("/", async (req, res) => {
  try {
    const { produtoId, tipo, dataInicio, dataFim } = req.query;
    const where = {};
    if (produtoId) where.produtoId = parseInt(produtoId);
    if (tipo) where.tipo = tipo;
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.data.lte = fim;
      }
    }
    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      include: { produto: true, venda: { include: { cliente: true } } },
      orderBy: { data: "desc" },
    });
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/estoque - registrar movimentação manual (apenas histórico)
router.post("/", async (req, res) => {
  try {
    const { produtoId, tipo, quantidade, data, observacao } = req.body;
    const qtd = parseFloat(quantidade);
    if (!["entrada", "saida", "ajuste", "devolucao"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    const produto = await prisma.produto.findUnique({
      where: { id: parseInt(produtoId) },
    });
    if (!produto) return res.status(400).json({ error: "Produto não encontrado" });

    const movimentacao = await prisma.movimentacaoEstoque.create({
      data: {
        produtoId: parseInt(produtoId),
        tipo,
        quantidade: qtd,
        data: data ? new Date(data) : new Date(),
        observacao,
      },
    });

    const movCompleta = await prisma.movimentacaoEstoque.findUnique({
      where: { id: movimentacao.id },
      include: { produto: true },
    });

    res.status(201).json(movCompleta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
