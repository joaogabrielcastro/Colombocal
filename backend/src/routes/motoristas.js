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
} = require("../utils/validation");

function tw(req) {
  return { tenantId: req.tenantId };
}

function parseMotoristaBody(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body?.nome !== undefined) {
    data.nome = parseRequiredString(body?.nome, "nome", { maxLength: 120 });
  }
  if (!partial || body?.telefone !== undefined) {
    data.telefone = parseOptionalString(body?.telefone, "telefone");
  }
  if (!partial || body?.veiculo !== undefined) {
    data.veiculo = parseOptionalString(body?.veiculo, "veiculo");
  }
  if (!partial || body?.placa !== undefined) {
    data.placa = parseOptionalString(body?.placa, "placa", { maxLength: 20 });
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
    const [motoristas, total] = await Promise.all([
      prisma.motorista.findMany({
        where,
        orderBy: { nome: "asc" },
        take,
        skip,
      }),
      prisma.motorista.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(motoristas);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const motorista = await prisma.motorista.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
    });
    if (!motorista)
      return res.status(404).json({ error: "Motorista não encontrado" });
    res.json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const data = parseMotoristaBody(req.body);
    const motorista = await prisma.motorista.create({
      data: { ...tw(req), ...data },
    });
    res.status(201).json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = parseMotoristaBody(req.body, { partial: true });
    const updated = await prisma.motorista.updateMany({
      where: { id, ...tw(req) },
      data,
    });
    if (!updated.count) return res.status(404).json({ error: "Motorista não encontrado" });

    const motorista = await prisma.motorista.findFirst({
      where: { id, ...tw(req) },
    });
    res.json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.motorista.updateMany({
      where: { id, ...tw(req) },
      data: { ativo: false },
    });
    if (!updated.count) return res.status(404).json({ error: "Motorista não encontrado" });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
