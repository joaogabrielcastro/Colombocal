const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 500,
    });
    const where = { ativo: true };
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
    const motorista = await prisma.motorista.findUnique({
      where: { id: parseInt(req.params.id) },
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
      data: { nome, telefone, veiculo, placa },
    });
    res.status(201).json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { nome, telefone, veiculo, placa, ativo } = req.body;
    const motorista = await prisma.motorista.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, telefone, veiculo, placa, ativo },
    });
    res.json(motorista);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.motorista.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
