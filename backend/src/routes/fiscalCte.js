const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  handleRouteError,
  parsePagination,
  setPaginationHeaders,
} = require("../utils/api");
const { parseIntField } = require("../utils/validation");
const { assertCteEnabled } = require("./fiscalTransporteHelpers");
const { cteEmitirSchema, cteCancelarSchema } = require("../schemas/cte");
const { emitirCte } = require("../application/use-cases/emitirCte");
const {
  consultarCte,
  cancelarCte,
} = require("../application/use-cases/gerirCte");
const { sanitizarCte } = require("../domain/cte/montarPayload");
const { createCteProvider } = require("../infra/cte/provider");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { getDateRange } = require("../utils/dateRangeQuery");

function auditFromReq(req) {
  return (payload) =>
    registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      userLabel: req.user?.email || req.user?.name,
      ...payload,
    });
}

router.get("/", async (req, res) => {
  try {
    await assertCteEnabled(req);
    const { skip, take, page, pageSize } = parsePagination(req);
    const range = getDateRange(
      req.query.dataInicio || req.query.de,
      req.query.dataFim || req.query.ate,
    );
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.numero) where.numero = Number(req.query.numero) || undefined;
    if (req.query.serie) where.serie = Number(req.query.serie) || undefined;
    if (req.query.destinatario) {
      where.destinatarioNome = {
        contains: String(req.query.destinatario),
        mode: "insensitive",
      };
    }
    if (req.query.origem) {
      where.OR = [
        { origemMunicipio: { contains: String(req.query.origem), mode: "insensitive" } },
        { origemUf: String(req.query.origem).toUpperCase() },
      ];
    }
    if (req.query.destino) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            {
              destinoMunicipio: {
                contains: String(req.query.destino),
                mode: "insensitive",
              },
            },
            { destinoUf: String(req.query.destino).toUpperCase() },
          ],
        },
      ];
    }
    if (range.gte || range.lte) where.emitidaEm = range;
    const [total, rows] = await Promise.all([
      prisma.conhecimentoTransporte.count({ where }),
      prisma.conhecimentoTransporte.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    setPaginationHeaders(res, { total, page, pageSize });
    res.json(rows.map(sanitizarCte));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    await assertCteEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await prisma.conhecimentoTransporte.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!doc) return res.status(404).json({ error: "CT-e não encontrado" });
    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      userLabel: req.user?.email,
      tipo: "CTE_VISUALIZADO",
      entidade: "ConhecimentoTransporte",
      entidadeId: doc.id,
    });
    res.json(sanitizarCte(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    await assertCteEnabled(req);
    const parsed = cteEmitirSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Dados inválidos",
        details: parsed.error.flatten(),
      });
    }
    const doc = await emitirCte(prisma, {
      tenantId: req.tenantId,
      input: parsed.data,
      audit: auditFromReq(req),
    });
    res.status(201).json(sanitizarCte(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/consultar", async (req, res) => {
  try {
    await assertCteEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await consultarCte(prisma, { tenantId: req.tenantId, id });
    res.json(sanitizarCte(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/cancelar", async (req, res) => {
  try {
    await assertCteEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const parsed = cteCancelarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Justificativa inválida",
      });
    }
    const doc = await cancelarCte(prisma, {
      tenantId: req.tenantId,
      id,
      justificativa: parsed.data.justificativa,
      audit: auditFromReq(req),
    });
    res.json(sanitizarCte(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

async function enviarArquivo(req, res, campo) {
  await assertCteEnabled(req);
  const id = parseIntField(req.params.id, "id");
  const doc = await prisma.conhecimentoTransporte.findFirst({
    where: { id, tenantId: req.tenantId },
  });
  if (!doc) return res.status(404).json({ error: "CT-e não encontrado" });
  const url = doc[campo];
  if (!url) {
    return res.status(404).json({ error: "Arquivo indisponível para este CT-e" });
  }
  const emitente = await prisma.emitenteFiscal.findUnique({
    where: { tenantId: req.tenantId },
  });
  const provider = createCteProvider({ emitente });
  const file = await provider.baixarArquivo(url);
  if (!file) {
    return res.status(404).json({ error: "Arquivo indisponível no provedor" });
  }
  await registrarAuditoria(prisma, req, {
    tenantId: req.tenantId,
    userId: req.user?.id,
    tipo: "CTE_XML_DOWNLOAD",
    entidade: "ConhecimentoTransporte",
    entidadeId: doc.id,
    payload: { campo },
  });
  res.setHeader("Content-Type", file.contentType);
  res.send(file.buffer);
}

router.get("/:id/xml", async (req, res) => {
  try {
    await enviarArquivo(req, res, "xmlUrl");
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id/dacte", async (req, res) => {
  try {
    await enviarArquivo(req, res, "dacteUrl");
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
