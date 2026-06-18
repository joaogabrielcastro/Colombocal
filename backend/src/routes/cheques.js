const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { registrarCheque } = require("../application/use-cases/registrarCheque");
const { registrarChequeLote } = require("../application/use-cases/registrarChequeLote");
const { excluirCheque } = require("../application/use-cases/excluirCheque");
const { parseIntField } = require("../utils/validation");
const { parseBody } = require("../utils/zodParse");
const {
  chequeCreateSchema,
  chequeLoteCreateSchema,
} = require("../schemas/cheque");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { actorFromReq } = require("../services/financeiroEventos");

function tw(req) {
  return { tenantId: req.tenantId };
}

// GET /api/cheques
router.get("/", async (req, res) => {
  try {
    const {
      clienteId,
      dataInicio,
      dataFim,
      ordem,
      cliente,
      emitente,
      banco,
      numero,
      valorMin,
      valorMax,
    } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const includeResumo =
      req.query.resumo === "1" || req.query.resumo === "true";

    const and = [{ ...tw(req) }];
    if (clienteId) and.push({ clienteId: parseInt(clienteId, 10) });
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
    if (cliente && String(cliente).trim()) {
      const term = String(cliente).trim();
      and.push({
        cliente: {
          OR: [
            { nomeFantasia: { contains: term, mode: "insensitive" } },
            { razaoSocial: { contains: term, mode: "insensitive" } },
            { cnpj: { contains: term } },
          ],
        },
      });
    }
    if (emitente && String(emitente).trim()) {
      and.push({
        emitenteNome: {
          contains: String(emitente).trim(),
          mode: "insensitive",
        },
      });
    }
    if (banco && String(banco).trim()) {
      and.push({ banco: { contains: String(banco).trim(), mode: "insensitive" } });
    }
    if (numero && String(numero).trim()) {
      and.push({ numero: { contains: String(numero).trim() } });
    }
    if (
      (valorMin != null && String(valorMin).trim() !== "") ||
      (valorMax != null && String(valorMax).trim() !== "")
    ) {
      const vr = {};
      if (valorMin != null && String(valorMin).trim() !== "") {
        const min = Number(String(valorMin).replace(",", "."));
        if (!Number.isNaN(min)) vr.gte = min;
      }
      if (valorMax != null && String(valorMax).trim() !== "") {
        const max = Number(String(valorMax).replace(",", "."));
        if (!Number.isNaN(max) && max > 0) vr.lte = max;
      }
      if (Object.keys(vr).length) and.push({ valor: vr });
    }
    const where = and.length > 1 || (and.length === 1 && Object.keys(and[0]).length > 1)
      ? { AND: and }
      : and[0];

    const queries = [
      prisma.cheque.findMany({
        where,
        include: {
          cliente: true,
          venda: { select: { id: true, numeroVenda: true, dataVenda: true, valorTotal: true } },
        },
        orderBy: { numeroOrdem: "desc" },
        take,
        skip,
      }),
      prisma.cheque.count({ where }),
    ];
    if (includeResumo) {
      queries.push(
        prisma.cheque.aggregate({
          where,
          _sum: { valor: true },
          _count: { id: true },
        }),
      );
    }

    const results = await Promise.all(queries);
    const cheques = results[0];
    const total = results[1];
    setPaginationHeaders(res, { total, take, skip });

    if (includeResumo) {
      const agg = results[2];
      res.json({
        items: cheques,
        resumo: {
          count: agg._count?.id ?? 0,
          total: parseFloat(String(agg._sum?.valor ?? 0)),
        },
      });
    } else {
      res.json(cheques);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/cheques/:id
router.get("/:id", async (req, res) => {
  try {
    const cheque = await prisma.cheque.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
      include: { cliente: true, pagamento: true },
    });
    if (!cheque)
      return res.status(404).json({ error: "Cheque não encontrado" });
    res.json(cheque);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cheques — registra pagamento e abate saldo do cliente na hora
router.post("/", async (req, res) => {
  try {
    const b = parseBody(chequeCreateSchema, req.body);
    const result = await registrarCheque(prisma, {
      ...b,
      tenantId: req.tenantId,
      auditActor: actorFromReq(req),
    });
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cheques/lote
router.post("/lote", async (req, res) => {
  try {
    const b = parseBody(chequeLoteCreateSchema, req.body);
    const result = await registrarChequeLote(prisma, {
      ...b,
      tenantId: req.tenantId,
      auditActor: actorFromReq(req),
    });
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/cheques/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    await excluirCheque(prisma, id, req.tenantId, actorFromReq(req));
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
