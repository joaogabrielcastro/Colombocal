const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/produtos
router.get("/", async (req, res) => {
  try {
    const { busca, ativo } = req.query;
    const where = {};
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigo: { contains: busca, mode: "insensitive" } },
      ];
    }
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: { nome: "asc" },
    });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/produtos/:id
router.get("/:id", async (req, res) => {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        movimentacoes: { orderBy: { data: "desc" }, take: 20 },
      },
    });
    if (!produto)
      return res.status(404).json({ error: "Produto não encontrado" });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/produtos
router.post("/", async (req, res) => {
  try {
    const { nome, codigo, precoPadrao, unidade, estoqueAtual, estoqueMinimo } =
      req.body;
    const produto = await prisma.produto.create({
      data: {
        nome,
        codigo,
        precoPadrao,
        unidade: unidade || "ton",
        estoqueAtual: estoqueAtual || 0,
        estoqueMinimo: estoqueMinimo || 0,
      },
    });
    res.status(201).json(produto);
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ error: "Código já cadastrado" });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/produtos/:id
router.put("/:id", async (req, res) => {
  try {
    const { nome, codigo, precoPadrao, unidade, estoqueMinimo, ativo } =
      req.body;
    const produto = await prisma.produto.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, codigo, precoPadrao, unidade, estoqueMinimo, ativo },
    });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/produtos/:id - inativar
router.delete("/:id", async (req, res) => {
  try {
    await prisma.produto.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
