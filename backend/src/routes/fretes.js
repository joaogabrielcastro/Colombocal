const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
} = require("../utils/validation");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");


// GET /api/fretes — listagem com filtros (painel / relatório)
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendaId, reciboEmitido, dataInicio, dataFim } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 50,
      maxTake: 500,
    });

    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId, 10);
    if (vendaId) where.vendaId = parseInt(vendaId, 10);
    if (reciboEmitido === "true") where.reciboEmitido = true;
    if (reciboEmitido === "false") where.reciboEmitido = false;
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(dataInicio);
      if (dataFim) {
        const f = new Date(dataFim);
        f.setHours(23, 59, 59, 999);
        where.data.lte = f;
      }
    }

    const [rows, total] = await Promise.all([
      prisma.freteMovimento.findMany({
        where,
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          venda: {
            select: { id: true, dataVenda: true, valorTotal: true, freteRecibo: true, freteReciboNum: true },
          },
        },
        orderBy: { data: "desc" },
        take,
        skip,
      }),
      prisma.freteMovimento.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(rows);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PATCH /api/fretes/:id — recibo e datas
router.patch("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const {
      reciboEmitido,
      reciboNumero,
      reciboData,
      data,
      observacao,
      valor,
    } = req.body;

    const existing = await prisma.freteMovimento.findUnique({
      where: { id },
      include: { venda: true },
    });
    if (!existing) return res.status(404).json({ error: "Frete não encontrado" });

    const dataPatch = {};
    if (reciboEmitido !== undefined) dataPatch.reciboEmitido = !!reciboEmitido;
    if (reciboNumero !== undefined) dataPatch.reciboNumero = reciboNumero || null;
    if (reciboData !== undefined)
      dataPatch.reciboData = reciboData
        ? parseDateField(reciboData, "reciboData")
        : null;
    if (data !== undefined && data !== null && data !== "")
      dataPatch.data = parseDateField(data, "data", { required: true });
    if (observacao !== undefined) dataPatch.observacao = observacao || null;
    if (valor !== undefined && valor !== null && valor !== "")
      dataPatch.valor = parseNumberField(valor, "valor", { min: 0 });

    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.freteMovimento.update({
        where: { id },
        data: dataPatch,
        include: {
          cliente: true,
          venda: true,
        },
      });

      if (f.vendaId && f.venda) {
        const primeiros = await tx.freteMovimento.findMany({
          where: { vendaId: f.vendaId },
          orderBy: { id: "asc" },
        });
        const primeiro = primeiros[0];
        const mesmoPrimeiro = primeiro && primeiro.id === f.id;
        if (mesmoPrimeiro || primeiros.length === 1) {
          await tx.venda.update({
            where: { id: f.vendaId },
            data: {
              freteRecibo: !!f.reciboEmitido,
              freteReciboNum: f.reciboNumero || null,
            },
          });
        }
      }

      await registrarEventoFinanceiro(tx, {
        tipo: "FRETE_ALTERADO",
        entidade: "FreteMovimento",
        entidadeId: id,
        clienteId: f.clienteId,
        vendaId: f.vendaId,
        valor: parseFloat(String(f.valor)),
        payload: dataPatch,
      });

      return f;
    });

    res.json(updated);
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
