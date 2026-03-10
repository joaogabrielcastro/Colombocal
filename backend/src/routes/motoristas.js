const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const motoristas = await prisma.motorista.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    res.json(motoristas);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
