const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");

function tw(req) {
  return { tenantId: req.tenantId };
}

router.get("/", async (req, res) => {
  try {
    const { busca } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 500,
    });
    const where = { ...tw(req), ativo: true };
    if (busca && String(busca).trim()) {
      where.nome = { contains: String(busca).trim(), mode: "insensitive" };
    }
    const [vendedores, total] = await Promise.all([
      prisma.vendedor.findMany({
        where,
        orderBy: { nome: "asc" },
        take,
        skip,
      }),
      prisma.vendedor.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(vendedores);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const vendedor = await prisma.vendedor.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
    });
    if (!vendedor)
      return res.status(404).json({ error: "Vendedor não encontrado" });
    res.json(vendedor);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const { nome, telefone, comissaoPercentual } = req.body;
    const vendedor = await prisma.vendedor.create({
      data: {
        ...tw(req),
        nome,
        telefone,
        comissaoPercentual: comissaoPercentual || 0,
      },
    });
    res.status(201).json(vendedor);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.vendedor.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Vendedor não encontrado" });

    const { nome, telefone, comissaoPercentual, ativo } = req.body;
    const vendedor = await prisma.vendedor.update({
      where: { id },
      data: { nome, telefone, comissaoPercentual, ativo },
    });
    res.json(vendedor);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.vendedor.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Vendedor não encontrado" });

    await prisma.vendedor.update({
      where: { id },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
