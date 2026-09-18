const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { parseBody } = require("../utils/zodParse");
const { handleRouteError } = require("../utils/api");
const { requireAdmin } = require("../middleware/auth");
const {
  sanitizarConfig,
  prepareSecretsForStorage,
} = require("../application/use-cases/cobrancaBancaria");
const { registrarAuditoria } = require("../services/financeiroEventos");
const {
  ensureCondicoesPadrao,
} = require("../services/condicaoPagamento");

const configPutSchema = z.object({
  banco: z.enum(["BRADESCO", "SICREDI", "bradesco", "sicredi"]).transform((v) =>
    String(v).toUpperCase(),
  ),
  ambiente: z.enum(["homologacao", "producao"]).optional(),
  agencia: z.string().nullable().optional(),
  conta: z.string().nullable().optional(),
  carteira: z.string().nullable().optional(),
  convenio: z.string().nullable().optional(),
  codigoBeneficiario: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  /// Objeto de secrets (clientId, apiKey, token, etc.) — nunca retornado no GET
  secrets: z.record(z.string()).optional().nullable(),
});

// GET /api/config/bancaria
router.get("/bancaria", requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.configuracaoBancaria.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { banco: "asc" },
    });
    res.json(rows.map(sanitizarConfig));
  } catch (error) {
    handleRouteError(res, error);
  }
});

// PUT /api/config/bancaria — upsert por banco
router.put("/bancaria", requireAdmin, async (req, res) => {
  try {
    const b = parseBody(configPutSchema, req.body);
    const secretsCipher =
      b.secrets !== undefined
        ? prepareSecretsForStorage(b.secrets)
        : undefined;

    const hasSecrets =
      secretsCipher != null ||
      (b.secrets === undefined &&
        !!(
          await prisma.configuracaoBancaria.findUnique({
            where: {
              tenantId_banco: { tenantId: req.tenantId, banco: b.banco },
            },
            select: { secretsCipher: true },
          })
        )?.secretsCipher);

    const status = hasSecrets || secretsCipher ? "CONFIGURADO" : "NAO_CONFIGURADO";

    const dataUpdate = {
      ambiente: b.ambiente ?? undefined,
      agencia: b.agencia === undefined ? undefined : b.agencia,
      conta: b.conta === undefined ? undefined : b.conta,
      carteira: b.carteira === undefined ? undefined : b.carteira,
      convenio: b.convenio === undefined ? undefined : b.convenio,
      codigoBeneficiario:
        b.codigoBeneficiario === undefined ? undefined : b.codigoBeneficiario,
      ativo: b.ativo ?? undefined,
      status,
    };
    if (secretsCipher !== undefined) {
      dataUpdate.secretsCipher = secretsCipher;
      dataUpdate.status = secretsCipher ? "CONFIGURADO" : "NAO_CONFIGURADO";
    }

    const row = await prisma.configuracaoBancaria.upsert({
      where: {
        tenantId_banco: { tenantId: req.tenantId, banco: b.banco },
      },
      create: {
        tenantId: req.tenantId,
        banco: b.banco,
        ambiente: b.ambiente || "homologacao",
        status: secretsCipher ? "CONFIGURADO" : "NAO_CONFIGURADO",
        agencia: b.agencia ?? null,
        conta: b.conta ?? null,
        carteira: b.carteira ?? null,
        convenio: b.convenio ?? null,
        codigoBeneficiario: b.codigoBeneficiario ?? null,
        secretsCipher: secretsCipher ?? null,
        ativo: b.ativo !== false,
      },
      update: dataUpdate,
    });

    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "BANCO_CONFIG_ATUALIZADO",
      entidade: "ConfiguracaoBancaria",
      entidadeId: row.id,
      payload: {
        banco: row.banco,
        ambiente: row.ambiente,
        status: row.status,
        secretsConfigurados: !!row.secretsCipher,
      },
    });

    res.json(sanitizarConfig(row));
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/config/condicoes-pagamento
router.get("/condicoes-pagamento", async (req, res) => {
  try {
    await ensureCondicoesPadrao(prisma, req.tenantId);
    const rows = await prisma.condicaoPagamento.findMany({
      where: { tenantId: req.tenantId, ativo: true },
      orderBy: { nome: "asc" },
    });
    res.json(rows);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/config/condicoes-pagamento
router.post("/condicoes-pagamento", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      nome: z.string().min(1),
      descricao: z.string().nullable().optional(),
      diasParcelas: z.array(z.coerce.number().int().nonnegative()).min(1),
      ativo: z.boolean().optional(),
    });
    const b = parseBody(schema, req.body);
    const row = await prisma.condicaoPagamento.create({
      data: {
        tenantId: req.tenantId,
        nome: b.nome,
        descricao: b.descricao ?? null,
        diasParcelas: b.diasParcelas,
        ativo: b.ativo !== false,
      },
    });
    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "CONDICAO_CRIADA",
      entidade: "CondicaoPagamento",
      entidadeId: row.id,
      payload: { nome: row.nome, diasParcelas: row.diasParcelas },
    });
    res.status(201).json(row);
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(400).json({ error: "Condição com este nome já existe" });
    }
    handleRouteError(res, error);
  }
});

// PUT /api/config/condicoes-pagamento/:id
router.put("/condicoes-pagamento/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const schema = z.object({
      nome: z.string().min(1).optional(),
      descricao: z.string().nullable().optional(),
      diasParcelas: z.array(z.coerce.number().int().nonnegative()).min(1).optional(),
      ativo: z.boolean().optional(),
    });
    const b = parseBody(schema, req.body);
    const existing = await prisma.condicaoPagamento.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Condição não encontrada" });
    }
    const row = await prisma.condicaoPagamento.update({
      where: { id },
      data: {
        nome: b.nome,
        descricao: b.descricao,
        diasParcelas: b.diasParcelas,
        ativo: b.ativo,
      },
    });
    await registrarAuditoria(prisma, req, {
      tenantId: req.tenantId,
      tipo: "CONDICAO_ALTERADA",
      entidade: "CondicaoPagamento",
      entidadeId: row.id,
      payload: { nome: row.nome, diasParcelas: row.diasParcelas, ativo: row.ativo },
    });
    res.json(row);
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
