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
    const {
      clienteId,
      vendaId,
      tipo,
      dataInicio,
      dataFim,
      cliente,
      ordem,
      emitente,
    } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const and = [{ ...tw(req) }];
    if (clienteId) and.push({ clienteId: parseInt(String(clienteId), 10) });
    if (vendaId) and.push({ vendaId: parseInt(String(vendaId), 10) });
    if (tipo && String(tipo).trim()) {
      const t = String(tipo).trim().toLowerCase();
      if (t === "pix") and.push({ tipo: "transferencia" });
      else and.push({ tipo: t });
    }
    if (dataInicio || dataFim) {
      const dr = {};
      if (dataInicio) dr.gte = new Date(String(dataInicio));
      if (dataFim) {
        const fim = new Date(String(dataFim));
        fim.setHours(23, 59, 59, 999);
        dr.lte = fim;
      }
      and.push({ data: dr });
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
    if (ordem != null && String(ordem).trim() !== "") {
      const n = parseInt(String(ordem).replace(/^#/, "").trim(), 10);
      if (!Number.isNaN(n) && n > 0) {
        and.push({
          OR: [{ vendaId: n }, { venda: { numeroVenda: n } }],
        });
      }
    }
    if (emitente && String(emitente).trim()) {
      and.push({
        cheque: {
          emitenteNome: {
            contains: String(emitente).trim(),
            mode: "insensitive",
          },
        },
      });
    }
    const where = and.length === 1 ? and[0] : { AND: and };
    const includeResumo =
      req.query.resumo === "1" || req.query.resumo === "true";

    const queries = [
      prisma.pagamento.findMany({
        where,
        include: {
          cliente: true,
          cheque: true,
          venda: { select: { id: true, numeroVenda: true, dataVenda: true, valorTotal: true } },
        },
        orderBy: { data: "desc" },
        take,
        skip,
      }),
      prisma.pagamento.count({ where }),
    ];
    if (includeResumo) {
      queries.push(
        prisma.pagamento.aggregate({
          where,
          _sum: { valor: true },
          _count: { id: true },
        }),
      );
    }

    const results = await Promise.all(queries);
    const pagamentos = results[0];
    const total = results[1];
    setPaginationHeaders(res, { total, take, skip });

    if (includeResumo) {
      const agg = results[2];
      return res.json({
        items: pagamentos,
        resumo: {
          count: agg._count?.id ?? 0,
          total: parseFloat(String(agg._sum?.valor ?? 0)),
        },
      });
    }
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
