const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  handleRouteError,
  parsePagination,
  setPaginationHeaders,
} = require("../utils/api");
const { parseIntField } = require("../utils/validation");
const { assertMdfeEnabled } = require("./fiscalTransporteHelpers");
const {
  mdfeEmitirSchema,
  mdfeCancelarSchema,
  mdfeEncerrarSchema,
} = require("../schemas/mdfe");
const { emitirMdfe } = require("../application/use-cases/emitirMdfe");
const {
  consultarMdfe,
  cancelarMdfe,
  encerrarMdfe,
} = require("../application/use-cases/gerirMdfe");
const { sanitizarMdfe } = require("../domain/mdfe/montarPayload");
const { createMdfeProvider } = require("../infra/mdfe/provider");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { getDateRange } = require("../utils/dateRangeQuery");

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
    await assertMdfeEnabled(req);
    const { skip, take, page, pageSize } = parsePagination(req);
    const range = getDateRange(
      req.query.dataInicio || req.query.de,
      req.query.dataFim || req.query.ate,
    );
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.numero) where.numero = Number(req.query.numero) || undefined;
    if (req.query.serie) where.serie = Number(req.query.serie) || undefined;
    if (req.query.ufOrigem) where.ufInicio = String(req.query.ufOrigem).toUpperCase();
    if (req.query.ufDestino) where.ufFim = String(req.query.ufDestino).toUpperCase();
    if (req.query.veiculo) {
      where.veiculoPlaca = {
        contains: String(req.query.veiculo),
        mode: "insensitive",
      };
    }
    if (req.query.motorista) {
      where.motoristaNome = {
        contains: String(req.query.motorista),
        mode: "insensitive",
      };
    }
    if (range.gte || range.lte) where.emitidaEm = range;
    const [total, rows] = await Promise.all([
      prisma.manifestoEletronico.count({ where }),
      prisma.manifestoEletronico.findMany({
        where,
        include: { documentos: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    setPaginationHeaders(res, { total, page, pageSize });
    res.json(rows.map(sanitizarMdfe));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    await assertMdfeEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await prisma.manifestoEletronico.findFirst({
      where: { id, tenantId: req.tenantId },
      include: { documentos: true },
    });
    if (!doc) return res.status(404).json({ error: "MDF-e não encontrado" });
    await registrarAuditoria(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      tipo: "MDFE_VISUALIZADO",
      entidade: "ManifestoEletronico",
      entidadeId: doc.id,
    });
    res.json(sanitizarMdfe(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    await assertMdfeEnabled(req);
    const parsed = mdfeEmitirSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Dados inválidos",
        details: parsed.error.flatten(),
      });
    }
    const doc = await emitirMdfe(prisma, {
      tenantId: req.tenantId,
      input: parsed.data,
      audit: auditFromReq(req),
    });
    res.status(201).json(sanitizarMdfe(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/consultar", async (req, res) => {
  try {
    await assertMdfeEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const doc = await consultarMdfe(prisma, { tenantId: req.tenantId, id });
    res.json(sanitizarMdfe(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/cancelar", async (req, res) => {
  try {
    await assertMdfeEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const parsed = mdfeCancelarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Justificativa inválida",
      });
    }
    const doc = await cancelarMdfe(prisma, {
      tenantId: req.tenantId,
      id,
      justificativa: parsed.data.justificativa,
      audit: auditFromReq(req),
    });
    res.json(sanitizarMdfe(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/:id/encerrar", async (req, res) => {
  try {
    await assertMdfeEnabled(req);
    const id = parseIntField(req.params.id, "id");
    const parsed = mdfeEncerrarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors?.[0]?.message || "Dados de encerramento inválidos",
      });
    }
    const doc = await encerrarMdfe(prisma, {
      tenantId: req.tenantId,
      id,
      data: parsed.data.data,
      siglaUf: parsed.data.siglaUf,
      nomeMunicipio: parsed.data.nomeMunicipio,
      audit: auditFromReq(req),
    });
    res.json(sanitizarMdfe(doc));
  } catch (error) {
    handleRouteError(res, error);
  }
});

async function enviarArquivo(req, res, campo) {
  await assertMdfeEnabled(req);
  const id = parseIntField(req.params.id, "id");
  const doc = await prisma.manifestoEletronico.findFirst({
    where: { id, tenantId: req.tenantId },
  });
  if (!doc) return res.status(404).json({ error: "MDF-e não encontrado" });
  const url = doc[campo];
  if (!url) {
    return res.status(404).json({ error: "Arquivo indisponível para este MDF-e" });
  }
  const emitente = await prisma.emitenteFiscal.findUnique({
    where: { tenantId: req.tenantId },
  });
  const provider = createMdfeProvider({ emitente });
  const file = await provider.baixarArquivo(url);
  if (!file) {
    return res.status(404).json({ error: "Arquivo indisponível no provedor" });
  }
  await registrarAuditoria(prisma, {
    tenantId: req.tenantId,
    userId: req.user?.id,
    tipo: "MDFE_XML_DOWNLOAD",
    entidade: "ManifestoEletronico",
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

router.get("/:id/damdfe", async (req, res) => {
  try {
    await enviarArquivo(req, res, "damdfeUrl");
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
