const { prisma } = require("../lib/prisma");
const { handleRouteError } = require("../utils/api");
const { parseBody } = require("../utils/zodParse");
const { parseIntField } = require("../utils/validation");
const { nfeCancelarSchema } = require("../schemas/nfe");
const { validarEmissaoNfe, emitirNfe } = require("../application/use-cases/emitirNfe");
const { cancelarNfe, consultarNfe } = require("../application/use-cases/gerirNfe");
const {
  notaBloqueanteDaVenda,
  ultimaNotaDaVenda,
  sanitizarNota,
} = require("../domain/nfe/notaDaVenda");
const { createNfeProvider } = require("../infra/nfe/provider");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { assertNfeEnabled, xmlMockDanfe, htmlDanfeMock } = require("./nfeHelpers");
const { STATUS } = require("../domain/nfe/constants");

function tw(req) {
  return { tenantId: req.tenantId };
}

function auditFn(req) {
  return (payload) =>
    registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      ...payload,
    });
}

async function enviarArquivoNota(req, res, kind) {
  await assertNfeEnabled(req);
  const vendaId = parseIntField(req.params.id, "id", { min: 1 });
  const nota = await ultimaNotaDaVenda(prisma, {
    tenantId: req.tenantId,
    vendaId,
  });
  if (!nota || nota.status !== STATUS.AUTORIZADA) {
    return res.status(400).json({ error: "Não há DANFE/XML de NF-e autorizada nesta venda." });
  }
  const venda = await prisma.venda.findFirst({
    where: { id: vendaId, ...tw(req) },
    select: { numeroVenda: true },
  });
  const emitente = await prisma.emitenteFiscal.findUnique({
    where: { tenantId: req.tenantId },
  });
  const provider = createNfeProvider({ emitente });
  const url = kind === "danfe" ? nota.danfeUrl : nota.xmlUrl;
  if (url && provider.baixarArquivo) {
    const file = await provider.baixarArquivo(url);
    if (file?.buffer) {
      res.setHeader("Content-Type", file.contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${kind}-nfe-${nota.numero || nota.id}.${kind === "xml" ? "xml" : "pdf"}"`,
      );
      return res.send(file.buffer);
    }
  }
  if (kind === "xml") {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nfe-${nota.numero || nota.id}.xml"`,
    );
    return res.send(xmlMockDanfe(nota, venda));
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(htmlDanfeMock(nota, venda));
}

function registerVendaNfeRoutes(router) {
  router.get("/:id/nfe", async (req, res) => {
    try {
      await assertNfeEnabled(req);
      const vendaId = parseIntField(req.params.id, "id", { min: 1 });
      const venda = await prisma.venda.findFirst({
        where: { id: vendaId, tenantId: req.tenantId },
        select: { id: true },
      });
      if (!venda) return res.status(404).json({ error: "Venda não encontrada" });
      const notas = await prisma.notaFiscal.findMany({
        where: { tenantId: req.tenantId, vendaId },
        orderBy: { createdAt: "desc" },
      });
      res.json({
        notaFiscal: sanitizarNota(notas[0] || null),
        notas: notas.map(sanitizarNota),
      });
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.get("/:id/nfe/validacao", async (req, res) => {
    try {
      await assertNfeEnabled(req);
      const vendaId = parseIntField(req.params.id, "id", { min: 1 });
      const result = await validarEmissaoNfe(prisma, {
        tenantId: req.tenantId,
        vendaId,
      });
      res.json(result);
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.post("/:id/nfe", async (req, res) => {
    try {
      await assertNfeEnabled(req);
      const vendaId = parseIntField(req.params.id, "id", { min: 1 });
      const nota = await emitirNfe(prisma, {
        tenantId: req.tenantId,
        vendaId,
        audit: auditFn(req),
      });
      res.status(201).json(sanitizarNota(nota));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.post("/:id/nfe/consultar", async (req, res) => {
    try {
      await assertNfeEnabled(req);
      const vendaId = parseIntField(req.params.id, "id", { min: 1 });
      const nota = await consultarNfe(prisma, {
        tenantId: req.tenantId,
        vendaId,
      });
      res.json(sanitizarNota(nota));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.post("/:id/nfe/cancelar", async (req, res) => {
    try {
      await assertNfeEnabled(req);
      const vendaId = parseIntField(req.params.id, "id", { min: 1 });
      const { justificativa } = parseBody(nfeCancelarSchema, req.body);
      const nota = await cancelarNfe(prisma, {
        tenantId: req.tenantId,
        vendaId,
        justificativa,
        audit: auditFn(req),
      });
      res.json(sanitizarNota(nota));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.get("/:id/nfe/danfe", async (req, res) => {
    try {
      await enviarArquivoNota(req, res, "danfe");
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  router.get("/:id/nfe/xml", async (req, res) => {
    try {
      await enviarArquivoNota(req, res, "xml");
    } catch (error) {
      handleRouteError(res, error);
    }
  });
}

async function anexarNotaNaVendaJson(req, venda) {
  try {
    const slug = await require("../utils/tenantRequest").getTenantSlug(req.tenantId);
    const features = await require("../services/tenantFeaturesResolver").getTenantFeatures(
      prisma,
      req.tenantId,
      slug,
    );
    if (!features.nfe) {
      return { notaFiscal: null, nfeBloqueiaEdicao: false };
    }
    const bloqueante = await notaBloqueanteDaVenda(prisma, {
      tenantId: req.tenantId,
      vendaId: venda.id,
    });
    const ultima = await ultimaNotaDaVenda(prisma, {
      tenantId: req.tenantId,
      vendaId: venda.id,
    });
    return {
      notaFiscal: sanitizarNota(ultima),
      nfeBloqueiaEdicao: !!bloqueante,
    };
  } catch {
    return { notaFiscal: null, nfeBloqueiaEdicao: false };
  }
}

module.exports = { registerVendaNfeRoutes, anexarNotaNaVendaJson };
