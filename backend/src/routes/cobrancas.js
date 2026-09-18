const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { getDateRange } = require("../utils/dateRangeQuery");
const {
  sanitizarCobranca,
  registrarCobranca,
  cancelarCobranca,
  loadProviderForBanco,
} = require("../application/use-cases/cobrancaBancaria");
const { BankBillingError, CODES } = require("../infra/billing/errors");
const { registrarAuditoria } = require("../services/financeiroEventos");

// GET /api/cobrancas
router.get("/", async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query);
    const range = getDateRange(req.query.dataInicio, req.query.dataFim);
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (req.query.banco) where.banco = String(req.query.banco).toUpperCase();
    if (req.query.clienteId) where.clienteId = parseInt(req.query.clienteId, 10);
    if (req.query.vendaId) where.vendaId = parseInt(req.query.vendaId, 10);
    if (range.gte || range.lte) {
      where.vencimento = range;
    }

    const [total, rows] = await Promise.all([
      prisma.cobrancaBancaria.count({ where }),
      prisma.cobrancaBancaria.findMany({
        where,
        skip,
        take,
        orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          venda: { select: { id: true, numeroVenda: true } },
          titulo: {
            select: {
              id: true,
              numero: true,
              parcelaNumero: true,
              parcelaTotal: true,
              status: true,
            },
          },
        },
      }),
    ]);
    setPaginationHeaders(res, { page, pageSize, total });
    res.json(rows.map(sanitizarCobranca));
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/cobrancas/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await prisma.cobrancaBancaria.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        cliente: true,
        venda: { select: { id: true, numeroVenda: true, bancoCobranca: true } },
        titulo: true,
      },
    });
    if (!row) return res.status(404).json({ error: "Cobrança não encontrada" });
    res.json(sanitizarCobranca(row));
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cobrancas/:id/registrar — retry / registro manual
router.post("/:id/registrar", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await registrarCobranca(prisma, {
      tenantId: req.tenantId,
      cobrancaId: id,
      auditReq: req,
    });
    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "COBRANCA_RETRY",
      entidade: "CobrancaBancaria",
      entidadeId: id,
      payload: { status: result.status },
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cobrancas/:id/cancelar
router.post("/:id/cancelar", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await cancelarCobranca(prisma, {
      tenantId: req.tenantId,
      cobrancaId: id,
      auditReq: req,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/cobrancas/:id/boleto — PDF quando disponível
router.get("/:id/boleto", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cobranca = await prisma.cobrancaBancaria.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!cobranca) return res.status(404).json({ error: "Cobrança não encontrada" });
    if (
      cobranca.status !== "DISPONIVEL" &&
      cobranca.status !== "REGISTRADA"
    ) {
      return res.status(409).json({
        error: "Boleto indisponível — cobrança ainda não registrada",
        status: cobranca.status,
      });
    }
    if (!cobranca.pdfRef && !cobranca.refExterna) {
      return res.status(404).json({
        error: "Boleto indisponível — PDF não fornecido pelo banco",
        linhaDigitavel: cobranca.linhaDigitavel,
        codigoBarras: cobranca.codigoBarras,
      });
    }

    const { provider } = await loadProviderForBanco(prisma, {
      tenantId: req.tenantId,
      banco: cobranca.banco,
    });
    try {
      const pdf = await provider.baixarBoletoPdf({
        refExterna: cobranca.refExterna,
        pdfRef: cobranca.pdfRef,
      });
      res.setHeader("Content-Type", pdf.contentType || "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="boleto-${cobranca.id}.pdf"`,
      );
      return res.send(pdf.buffer);
    } catch (err) {
      if (err instanceof BankBillingError && err.code === CODES.PDF_UNAVAILABLE) {
        return res.status(404).json({
          error: err.message,
          linhaDigitavel: cobranca.linhaDigitavel,
          codigoBarras: cobranca.codigoBarras,
        });
      }
      throw err;
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
