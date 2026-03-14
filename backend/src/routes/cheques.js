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
      include: {
        cliente: true,
        venda: { select: { id: true, dataVenda: true, valorTotal: true } },
      },
      orderBy: { numeroOrdem: "desc" },
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

// POST /api/cheques - registrar cheque
// status inicial: a_receber (sem pagamento) | recebido (com pagamento)
router.post("/", async (req, res) => {
  try {
    const {
      clienteId,
      vendaId,
      valor,
      banco,
      numero,
      agencia,
      conta,
      dataRecebimento,
      dataCompensacao,
      status,
      observacoes,
    } = req.body;

    const statusInicial = status || "a_receber";
    const validStatuses = ["a_receber", "recebido", "depositado"];
    if (!validStatuses.includes(statusInicial)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const cheque = await prisma.$transaction(async (tx) => {
      const novoCheque = await tx.cheque.create({
        data: {
          clienteId: parseInt(clienteId),
          vendaId: vendaId ? parseInt(vendaId) : null,
          valor: parseFloat(valor),
          banco,
          numero,
          agencia,
          conta,
          dataRecebimento: dataRecebimento
            ? new Date(dataRecebimento)
            : new Date(),
          dataCompensacao: dataCompensacao ? new Date(dataCompensacao) : null,
          status: statusInicial,
          observacoes,
        },
      });

      // Pagamento só é criado quando o cheque foi efetivamente recebido
      if (statusInicial === "recebido" || statusInicial === "depositado") {
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
      }

      return novoCheque;
    });

    const chequeCompleto = await prisma.cheque.findUnique({
      where: { id: cheque.id },
      include: { cliente: true, venda: true, pagamento: true },
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
    const validStatuses = ["a_receber", "recebido", "depositado"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const chequeAtual = await prisma.cheque.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { pagamento: true },
    });
    if (!chequeAtual)
      return res.status(404).json({ error: "Cheque não encontrado" });

    const data = { status };
    if (status === "depositado" && dataCompensacao) {
      data.dataCompensacao = new Date(dataCompensacao);
    }

    await prisma.$transaction(async (tx) => {
      await tx.cheque.update({ where: { id: parseInt(req.params.id) }, data });

      const temPagamento = !!chequeAtual.pagamento;
      const precisaPagamento = status === "recebido" || status === "depositado";

      // Se mudou para recebido/depositado e ainda não tem pagamento, cria
      if (precisaPagamento && !temPagamento) {
        await tx.pagamento.create({
          data: {
            clienteId: chequeAtual.clienteId,
            tipo: "cheque",
            valor: chequeAtual.valor,
            data: chequeAtual.dataRecebimento,
            chequeId: chequeAtual.id,
            observacoes: `Cheque #${chequeAtual.numero || chequeAtual.id} - ${chequeAtual.banco || ""}`,
          },
        });
      }

      // Se voltou para a_receber, remove pagamento (cheque não foi recebido)
      if (status === "a_receber" && temPagamento) {
        await tx.pagamento.deleteMany({ where: { chequeId: chequeAtual.id } });
      }
    });

    const cheque = await prisma.cheque.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: true, venda: true },
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
