const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/pagamentos
router.get("/", async (req, res) => {
  try {
    const { clienteId } = req.query;
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    const pagamentos = await prisma.pagamento.findMany({
      where,
      include: { cliente: true, cheque: true },
      orderBy: { data: "desc" },
    });
    res.json(pagamentos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pagamentos - registrar pagamento em dinheiro ou transferência
router.post("/", async (req, res) => {
  try {
    const { clienteId, tipo, valor, data, observacoes } = req.body;
    if (tipo === "cheque") {
      return res
        .status(400)
        .json({ error: "Para cheques, use a rota /api/cheques" });
    }
    const pagamento = await prisma.pagamento.create({
      data: {
        clienteId: parseInt(clienteId),
        tipo,
        valor: parseFloat(valor),
        data: data ? new Date(data) : new Date(),
        observacoes,
      },
      include: { cliente: true },
    });
    res.status(201).json(pagamento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pagamentos/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.pagamento.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
