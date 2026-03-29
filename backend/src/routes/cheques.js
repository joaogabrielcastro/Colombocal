const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const {
  aplicarPagamentoNosTitulos,
  recalcularTitulos,
} = require("../services/recebiveis");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
  ensureEnum,
} = require("../utils/validation");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const prisma = new PrismaClient();

// GET /api/cheques
router.get("/", async (req, res) => {
  try {
    const { clienteId, status, dataInicio, dataFim, ordem } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const and = [];
    if (clienteId) and.push({ clienteId: parseInt(clienteId, 10) });
    if (status) and.push({ status });
    if (dataInicio || dataFim) {
      const dr = {};
      if (dataInicio) dr.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        dr.lte = fim;
      }
      and.push({ dataRecebimento: dr });
    }
    if (ordem != null && String(ordem).trim() !== "") {
      const n = parseInt(String(ordem).replace(/^#/, "").trim(), 10);
      if (!Number.isNaN(n) && n > 0) {
        and.push({
          OR: [{ numeroOrdem: n }, { vendaId: n }],
        });
      }
    }
    const where = and.length ? { AND: and } : {};
    const [cheques, total] = await Promise.all([
      prisma.cheque.findMany({
        where,
        include: {
          cliente: true,
          venda: { select: { id: true, dataVenda: true, valorTotal: true } },
        },
        orderBy: { numeroOrdem: "desc" },
        take,
        skip,
      }),
      prisma.cheque.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(cheques);
  } catch (error) {
    handleRouteError(res, error);
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
    handleRouteError(res, error);
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

    const statusInicial = ensureEnum(status || "a_receber", "status", [
      "a_receber",
      "recebido",
      "depositado",
      "devolvido",
    ]);
    const clienteIdNum = parseIntField(clienteId, "clienteId", { min: 1 });
    const vendaIdNum = parseIntField(vendaId, "vendaId", {
      required: false,
      min: 1,
    });
    const valorNum = parseNumberField(valor, "valor", { min: 0.01 });
    const dataRecebimentoDate = parseDateField(dataRecebimento, "dataRecebimento", {
      required: false,
    });
    const dataCompensacaoDate = parseDateField(
      dataCompensacao,
      "dataCompensacao",
      { required: false },
    );

    const cheque = await prisma.$transaction(async (tx) => {
      const novoCheque = await tx.cheque.create({
        data: {
          clienteId: clienteIdNum,
          vendaId: vendaIdNum,
          valor: valorNum,
          banco,
          numero,
          agencia,
          conta,
          dataRecebimento: dataRecebimentoDate || new Date(),
          dataCompensacao: dataCompensacaoDate,
          status: statusInicial,
          observacoes,
        },
      });

      // Pagamento só é criado quando o cheque foi efetivamente recebido
      if (statusInicial === "recebido" || statusInicial === "depositado") {
        await tx.pagamento.create({
          data: {
            clienteId: clienteIdNum,
            vendaId: novoCheque.vendaId,
            tipo: "cheque",
            valor: valorNum,
            data: dataRecebimentoDate || new Date(),
            chequeId: novoCheque.id,
            observacoes: `Cheque #${numero || novoCheque.id} - ${banco || ""}`,
          },
        });
        await aplicarPagamentoNosTitulos(tx, {
          clienteId: clienteIdNum,
          vendaId: novoCheque.vendaId,
          valor: valorNum,
        });
      }
      await registrarEventoFinanceiro(tx, {
        tipo: "CHEQUE_CRIADO",
        entidade: "Cheque",
        entidadeId: novoCheque.id,
        chequeId: novoCheque.id,
        clienteId: clienteIdNum,
        vendaId: novoCheque.vendaId,
        valor: valorNum,
        payload: { status: statusInicial, banco: banco || null },
      });

      return novoCheque;
    });

    const chequeCompleto = await prisma.cheque.findUnique({
      where: { id: cheque.id },
      include: { cliente: true, venda: true, pagamento: true },
    });

    res.status(201).json(chequeCompleto);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// PATCH /api/cheques/:id/status - atualizar status do cheque
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, dataCompensacao } = req.body;
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const statusValidado = ensureEnum(status, "status", [
      "a_receber",
      "recebido",
      "depositado",
      "devolvido",
    ]);
    const dataCompensacaoDate = parseDateField(
      dataCompensacao,
      "dataCompensacao",
      { required: false },
    );

    const chequeAtual = await prisma.cheque.findUnique({
      where: { id },
      include: { pagamento: true },
    });
    if (!chequeAtual)
      return res.status(404).json({ error: "Cheque não encontrado" });

    const data = { status: statusValidado };
    if (statusValidado === "depositado") {
      data.dataCompensacao = dataCompensacaoDate || new Date();
    }

    await prisma.$transaction(async (tx) => {
      await tx.cheque.update({ where: { id }, data });
      await registrarEventoFinanceiro(tx, {
        tipo: "CHEQUE_STATUS_ALTERADO",
        entidade: "Cheque",
        entidadeId: chequeAtual.id,
        chequeId: chequeAtual.id,
        clienteId: chequeAtual.clienteId,
        vendaId: chequeAtual.vendaId,
        valor: parseFloat(chequeAtual.valor),
        payload: { de: chequeAtual.status, para: statusValidado },
      });

      const temPagamento = !!chequeAtual.pagamento;
      const precisaPagamento =
        statusValidado === "recebido" || statusValidado === "depositado";

      // Se mudou para recebido/depositado e ainda não tem pagamento, cria
      if (precisaPagamento && !temPagamento) {
        await tx.pagamento.create({
          data: {
            clienteId: chequeAtual.clienteId,
            vendaId: chequeAtual.vendaId,
            tipo: "cheque",
            valor: chequeAtual.valor,
            data: chequeAtual.dataRecebimento,
            chequeId: chequeAtual.id,
            observacoes: `Cheque #${chequeAtual.numero || chequeAtual.id} - ${chequeAtual.banco || ""}`,
          },
        });
      }

      // Se voltou para a_receber/devolvido, remove pagamento e recalcula títulos
      if (
        (statusValidado === "a_receber" || statusValidado === "devolvido") &&
        temPagamento
      ) {
        await tx.pagamento.deleteMany({ where: { chequeId: chequeAtual.id } });
        await recalcularTitulos(tx, {
          clienteId: chequeAtual.clienteId,
          vendaId: chequeAtual.vendaId,
        });
      }
    });

    const cheque = await prisma.cheque.findUnique({
      where: { id },
      include: { cliente: true, venda: true },
    });
    res.json(cheque);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/cheques/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const cheque = await tx.cheque.findUnique({
        where: { id },
        include: { pagamento: true },
      });
      if (!cheque) throw new Error("Cheque não encontrado");

      await tx.pagamento.deleteMany({ where: { chequeId: id } });
      await tx.cheque.delete({ where: { id } });
      await registrarEventoFinanceiro(tx, {
        tipo: "CHEQUE_EXCLUIDO",
        entidade: "Cheque",
        entidadeId: cheque.id,
        chequeId: cheque.id,
        clienteId: cheque.clienteId,
        vendaId: cheque.vendaId,
        valor: parseFloat(cheque.valor),
      });

      await recalcularTitulos(tx, {
        clienteId: cheque.clienteId,
        vendaId: cheque.vendaId,
      });
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
