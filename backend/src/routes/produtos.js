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

// GET /api/produtos
router.get("/", async (req, res) => {
  try {
    const { busca, ativo } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 500,
    });
    const where = { ...tw(req) };
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigo: { contains: busca, mode: "insensitive" } },
      ];
    }
    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        orderBy: { nome: "asc" },
        take,
        skip,
      }),
      prisma.produto.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(produtos);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/produtos/:id
router.get("/:id", async (req, res) => {
  try {
    const produto = await prisma.produto.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
      include: {
        movimentacoes: {
          where: tw(req),
          orderBy: { data: "desc" },
          take: 20,
        },
      },
    });
    if (!produto)
      return res.status(404).json({ error: "Produto não encontrado" });
    res.json(produto);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/produtos
router.post("/", async (req, res) => {
  try {
    const { nome, codigo, precoPadrao, unidade } = req.body;
    const codigoTrim =
      codigo != null && String(codigo).trim() !== ""
        ? String(codigo).trim()
        : null;
    const codigoFinal =
      codigoTrim ||
      `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const produto = await prisma.produto.create({
      data: {
        ...tw(req),
        nome,
        codigo: codigoFinal,
        precoPadrao,
        unidade: unidade || "ton",
      },
    });
    res.status(201).json(produto);
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ error: "Código já cadastrado" });
    handleRouteError(res, error);
  }
});

// PUT /api/produtos/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.produto.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Produto não encontrado" });

    const { nome, codigo, precoPadrao, unidade, ativo } = req.body;
    const produto = await prisma.produto.update({
      where: { id },
      data: { nome, codigo, precoPadrao, unidade, ativo },
    });
    res.json(produto);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/produtos/:id - inativar
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.produto.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Produto não encontrado" });

    await prisma.produto.update({
      where: { id },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
