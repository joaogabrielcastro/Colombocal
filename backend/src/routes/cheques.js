const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/cheques
router.get("/", async (req, res) => {
  try {
    const { clienteId, status, dataInicio, dataFim } = req.query;
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    if (status) where.status = status;
    if (dataInicio || dataFim) {
      where.dataRecebimento = {};
      if (dataInicio) where.dataRecebimento.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.dataRecebimento.lte = fim;
      }
    }
    const cheques = await prisma.cheque.findMany({
      where,
      include: { cliente: true },
      orderBy: { dataRecebimento: "desc" },
    });
    res.json(cheques);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cheques/:id
router.get("/:id", async (req, res) => {
  try {
    const cheque = await prisma.cheque.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: true, pagamento: true },
    });
    if (!cheque)
      return res.status(404).json({ error: "Cheque não encontrado" });
    res.json(cheque);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cheques - registrar cheque e gerar pagamento
router.post("/", async (req, res) => {
  try {
    const {
      clienteId,
      valor,
      banco,
      numero,
      agencia,
      conta,
      dataRecebimento,
      dataCompensacao,
      observacoes,
    } = req.body;

    const cheque = await prisma.$transaction(async (tx) => {
      const novoCheque = await tx.cheque.create({
        data: {
          clienteId: parseInt(clienteId),
          valor: parseFloat(valor),
          banco,
          numero,
          agencia,
          conta,
          dataRecebimento: dataRecebimento
            ? new Date(dataRecebimento)
            : new Date(),
          dataCompensacao: dataCompensacao ? new Date(dataCompensacao) : null,
          status: "recebido",
          observacoes,
        },
      });

      // Gerar pagamento automático quando cheque é registrado
      await tx.pagamento.create({
        data: {
          clienteId: parseInt(clienteId),
          tipo: "cheque",
          valor: parseFloat(valor),
          data: dataRecebimento ? new Date(dataRecebimento) : new Date(),
          chequeId: novoCheque.id,
          observacoes: `Cheque #${numero || novoCheque.id} - ${banco || ""}`,
        },
      });

      return novoCheque;
    });

    const chequeCompleto = await prisma.cheque.findUnique({
      where: { id: cheque.id },
      include: { cliente: true, pagamento: true },
    });

    res.status(201).json(chequeCompleto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/cheques/:id/status - atualizar status do cheque
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, dataCompensacao } = req.body;
    const validStatuses = ["recebido", "depositado", "compensado", "devolvido"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const data = { status };
    if (status === "compensado" && dataCompensacao) {
      data.dataCompensacao = new Date(dataCompensacao);
    }

    // Se devolvido, remover o pagamento para voltar o débito na conta
    if (status === "devolvido") {
      await prisma.$transaction(async (tx) => {
        await tx.cheque.update({
          where: { id: parseInt(req.params.id) },
          data,
        });
        await tx.pagamento.deleteMany({
          where: { chequeId: parseInt(req.params.id) },
        });
      });
    } else {
      await prisma.cheque.update({
        where: { id: parseInt(req.params.id) },
        data,
      });
    }

    const cheque = await prisma.cheque.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: true },
    });
    res.json(cheque);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cheques/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.pagamento.deleteMany({ where: { chequeId: id } });
      await tx.cheque.delete({ where: { id } });
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
