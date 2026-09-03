const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const {
  parseRequiredString,
  parseOptionalString,
  parseNumberField,
} = require("../utils/validation");

function tw(req) {
  return { tenantId: req.tenantId };
}

function parseVendedorBody(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body?.nome !== undefined) {
    data.nome = parseRequiredString(body?.nome, "nome", { maxLength: 120 });
  }
  if (!partial || body?.telefone !== undefined) {
    data.telefone = parseOptionalString(body?.telefone, "telefone");
  }
  if (!partial || body?.comissaoPercentual !== undefined) {
    data.comissaoPercentual =
      parseNumberField(body?.comissaoPercentual, "comissaoPercentual", {
        required: false,
        min: 0,
      }) ?? 0;
  }
  if (body?.ativo !== undefined) {
    if (typeof body.ativo !== "boolean") {
      const err = new Error("ativo inválido");
      err.statusCode = 400;
      throw err;
    }
    data.ativo = body.ativo;
  }
  return data;
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
    const data = parseVendedorBody(req.body);
    const vendedor = await prisma.vendedor.create({
      data: { ...tw(req), ...data },
    });
    res.status(201).json(vendedor);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = parseVendedorBody(req.body, { partial: true });
    const updated = await prisma.vendedor.updateMany({
      where: { id, ...tw(req) },
      data,
    });
    if (!updated.count) return res.status(404).json({ error: "Vendedor não encontrado" });

    const vendedor = await prisma.vendedor.findFirst({
      where: { id, ...tw(req) },
    });
    res.json(vendedor);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.vendedor.updateMany({
      where: { id, ...tw(req) },
      data: { ativo: false },
    });
    if (!updated.count) return res.status(404).json({ error: "Vendedor não encontrado" });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
