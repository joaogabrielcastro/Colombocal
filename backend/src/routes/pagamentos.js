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

// GET /api/pagamentos
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendaId } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    if (vendaId) where.vendaId = parseInt(vendaId);
    const [pagamentos, total] = await Promise.all([
      prisma.pagamento.findMany({
        where,
        include: { cliente: true, cheque: true, venda: true },
        orderBy: { data: "desc" },
        take,
        skip,
      }),
      prisma.pagamento.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(pagamentos);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/pagamentos - registrar pagamento em dinheiro ou transferência (baixa por cliente ou por venda)
router.post("/", async (req, res) => {
  try {
    const { clienteId, vendaId, tipo, valor, data, observacoes } = req.body;
    const tipoNormalizado = ensureEnum(tipo, "tipo", [
      "dinheiro",
      "transferencia",
      "cheque",
    ]);
    if (tipoNormalizado === "cheque") {
      return res
        .status(400)
        .json({ error: "Para cheques, use a rota /api/cheques" });
    }
    const clienteIdNum = parseIntField(clienteId, "clienteId", { min: 1 });
    const vendaIdNum = parseIntField(vendaId, "vendaId", {
      required: false,
      min: 1,
    });
    const valorNum = parseNumberField(valor, "valor", { min: 0.01 });
    const dataPagamento = parseDateField(data, "data", { required: false });

    const pagamento = await prisma.$transaction(async (tx) => {
      const novoPagamento = await tx.pagamento.create({
        data: {
          clienteId: clienteIdNum,
          vendaId: vendaIdNum,
          tipo: tipoNormalizado,
          valor: valorNum,
          data: dataPagamento || new Date(),
          observacoes,
        },
        include: { cliente: true, venda: true },
      });

      await aplicarPagamentoNosTitulos(tx, {
        clienteId: clienteIdNum,
        vendaId: vendaIdNum,
        valor: valorNum,
      });
      await registrarEventoFinanceiro(tx, {
        tipo: "PAGAMENTO_CRIADO",
        entidade: "Pagamento",
        entidadeId: novoPagamento.id,
        pagamentoId: novoPagamento.id,
        clienteId: clienteIdNum,
        vendaId: vendaIdNum,
        valor: valorNum,
        payload: { tipo: tipoNormalizado },
      });

      return novoPagamento;
    });
    res.status(201).json(pagamento);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/pagamentos/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const pagamento = await tx.pagamento.findUnique({ where: { id } });
      if (!pagamento) throw new Error("Pagamento não encontrado");
      await tx.pagamento.delete({ where: { id } });
      await registrarEventoFinanceiro(tx, {
        tipo: "PAGAMENTO_EXCLUIDO",
        entidade: "Pagamento",
        entidadeId: pagamento.id,
        pagamentoId: pagamento.id,
        clienteId: pagamento.clienteId,
        vendaId: pagamento.vendaId,
        valor: parseFloat(pagamento.valor),
      });

      await recalcularTitulos(tx, {
        clienteId: pagamento.clienteId,
        vendaId: pagamento.vendaId,
      });
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
