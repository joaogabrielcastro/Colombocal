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
    const { nome, telefone, veiculo, placa } = req.body;
    const motorista = await prisma.motorista.create({
      data: { ...tw(req), nome, telefone, veiculo, placa },
    });
    res.status(201).json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.motorista.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Motorista não encontrado" });

    const { nome, telefone, veiculo, placa, ativo } = req.body;
    const motorista = await prisma.motorista.update({
      where: { id },
      data: { nome, telefone, veiculo, placa, ativo },
    });
    res.json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.motorista.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Motorista não encontrado" });

    await prisma.motorista.update({
      where: { id },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
