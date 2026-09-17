const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  handleRouteError,
  parsePagination,
  setPaginationHeaders,
} = require("../utils/api");
const { parseIntField } = require("../utils/validation");
const { assertCiotEnabled } = require("./fiscalTransporteHelpers");
const { ciotRegistrarSchema } = require("../schemas/ciot");
const {
  registrarCiot,
  consultarCiot,
  cancelarCiot,
} = require("../application/use-cases/registrarCiot");
const { sanitizarCiot } = require("../domain/ciot/constants");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { getDateRange } = require("../utils/dateRangeQuery");
const { resolveCiotProviderName } = require("../infra/ciot/provider");

function auditFromReq(req) {
  return (payload) =>
    registrarAuditoria(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      userLabel: req.user?.email || req.user?.name,
      ...payload,
    });
}

router.get("/", async (req, res) => {
  try {
    await assertCiotEnabled(req);
    const { skip, take, page, pageSize } = parsePagination(req);
    const range = getDateRange(
      req.query.dataInicio || req.query.de,
      req.query.dataFim || req.query.ate,
    );
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.codigoCiot) {
      where.codigoCiot = {
        contains: String(req.query.codigoCiot),
        mode: "insensitive",
      };
    }
    if (req.query.motorista) {
      where.motoristaNome = {
        contains: String(req.query.motorista),
        mode: "insensitive",
      };
    }
    if (req.query.transportador) {
      where.transportadorNome = {
        contains: String(req.query.transportador),
        mode: "insensitive",
      };
    }
    if (req.query.veiculo) {
      where.veiculoPlaca = {
        contains: String(req.query.veiculo),
        mode: "insensitive",
      };
    }
    if (range.gte || range.lte) where.dataOperacao = range;
    const [total, rows] = await Promise.all([
      prisma.operacaoCiot.count({ where }),
      prisma.operacaoCiot.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    setPaginationHeaders(res, { total, page, pageSize });
    res.json({
      provider: resolveCiotProviderName(),
      items: rows.map(sanitizarCiot),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    await assertCiotEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await prisma.operacaoCiot.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!doc) return res.status(404).json({ error: "CIOT não encontrado" });
    await registrarAuditoria(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      tipo: "CIOT_VISUALIZADO",
      entidade: "OperacaoCiot",
      entidadeId: doc.id,
    });
    res.json({
      ...sanitizarCiot(doc),
      providerName: resolveCiotProviderName(),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    await assertCiotEnabled(req);
    const parsed = ciotRegistrarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Dados inválidos",
        details: parsed.error.flatten(),
      });
    }
    const doc = await registrarCiot(prisma, {
      tenantId: req.tenantId,
      input: parsed.data,
      audit: auditFromReq(req),
    });
    res.status(201).json(sanitizarCiot(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/consultar", async (req, res) => {
  try {
    await assertCiotEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await consultarCiot(prisma, { tenantId: req.tenantId, id });
    res.json(sanitizarCiot(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/cancelar", async (req, res) => {
  try {
    await assertCiotEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await cancelarCiot(prisma, {
      tenantId: req.tenantId,
      id,
      audit: auditFromReq(req),
    });
    res.json(sanitizarCiot(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
