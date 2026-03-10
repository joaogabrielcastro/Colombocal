const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const vendedores = await prisma.vendedor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    res.json(vendedores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!vendedor)
      return res.status(404).json({ error: "Vendedor não encontrado" });
    res.json(vendedor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { nome, telefone, comissaoPercentual } = req.body;
    const vendedor = await prisma.vendedor.create({
      data: { nome, telefone, comissaoPercentual: comissaoPercentual || 0 },
    });
    res.status(201).json(vendedor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { nome, telefone, comissaoPercentual, ativo } = req.body;
    const vendedor = await prisma.vendedor.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, telefone, comissaoPercentual, ativo },
    });
    res.json(vendedor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.vendedor.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
