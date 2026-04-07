const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  recalcularTitulos,
  recalcularTodosTitulosCliente,
} = require("../services/recebiveis");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");
const { parseIntField } = require("../utils/validation");
const { parseBody } = require("../utils/zodParse");
const { pagamentoCreateSchema } = require("../schemas/pagamento");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");

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
    const b = parseBody(pagamentoCreateSchema, req.body);
    if (b.tipo === "cheque") {
      return res
        .status(400)
        .json({ error: "Para cheques, use a rota /api/cheques" });
    }
    const dataPagamento =
      b.data instanceof Date
        ? b.data
        : b.data
          ? new Date(b.data)
          : new Date();

    const pagamento = await prisma.$transaction(async (tx) => {
      const novoPagamento = await tx.pagamento.create({
        data: {
          clienteId: b.clienteId,
          vendaId: b.vendaId ?? null,
          tipo: b.tipo,
          valor: b.valor,
          data: dataPagamento,
          observacoes: b.observacoes,
        },
        include: { cliente: true, venda: true },
      });

      await recalcularTodosTitulosCliente(tx, b.clienteId);
      await registrarEventoFinanceiro(tx, {
        tipo: "PAGAMENTO_CRIADO",
        entidade: "Pagamento",
        entidadeId: novoPagamento.id,
        pagamentoId: novoPagamento.id,
        clienteId: b.clienteId,
        vendaId: b.vendaId ?? null,
        valor: b.valor,
        payload: { tipo: b.tipo },
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
    const id = parseIntField(req.params.id, "id", { min: 1 });
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
