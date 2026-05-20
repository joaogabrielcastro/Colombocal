const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { registrarPagamento } = require("../application/use-cases/registrarPagamento");
const { excluirPagamento } = require("../application/use-cases/excluirPagamento");
const { parseIntField } = require("../utils/validation");
const { parseBody } = require("../utils/zodParse");
const { pagamentoCreateSchema } = require("../schemas/pagamento");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { actorFromReq } = require("../services/financeiroEventos");

function tw(req) {
  return { tenantId: req.tenantId };
}

// GET /api/pagamentos
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendaId } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = { ...tw(req) };
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
    const pagamento = await registrarPagamento(prisma, {
      ...b,
      tenantId: req.tenantId,
      auditActor: actorFromReq(req),
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
    await excluirPagamento(prisma, id, req.tenantId, actorFromReq(req));
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
