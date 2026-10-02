const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAdmin } = require("../middleware/auth");
const { setConfig } = require("../services/configSistema");
const { executarResetFinanceiroLegacy } = require("../services/resetFinanceiroLegacy");
const {
  getTenantFeatures,
  setTenantFeatures,
} = require("../services/tenantFeaturesResolver");
const { getTenantSlug } = require("../utils/tenantRequest");
const { handleRouteError } = require("../utils/api");
const { timingSafeEqualString } = require("../utils/setupSecret");
const { parseBody } = require("../utils/zodParse");
const { emitenteFiscalSchema } = require("../schemas/nfe");
const { onlyDigits } = require("../utils/cpf");
const {
  listarEmitentesFiscais,
  buscarEmitenteFiscal,
  definirEmitentePadrao,
} = require("../services/emitenteFiscal");

/**
 * POST /api/config/reset-financeiro-legacy
 * Uso único: quita todos os títulos, remove cheques e pagamentos vinculados a cheques.
 * Por padrão também cria pagamentos de ajuste para zerar saldo devedor na conta corrente.
 * Se enviar zerarTotal: true, remove pagamentos/cheques e também vendas+títulos.
 * Protegido por ADMIN_RESET_SECRET ou RESET_FINANCE_SECRET no .env.
 * Alternativa sem API: npm run legacy:reset-financeiro (na pasta backend). Ver docs/migracao-legado.md.
 */
router.post("/reset-financeiro-legacy", requireAdmin, async (req, res) => {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ENABLE_LEGACY_RESET_API !== "true"
    ) {
      return res.status(403).json({
        error:
          "Operação desativada em produção. Defina ENABLE_LEGACY_RESET_API=true para habilitar explicitamente.",
      });
    }

    const secret =
      process.env.ADMIN_RESET_SECRET || process.env.RESET_FINANCE_SECRET;
    if (!secret) {
      return res.status(503).json({
        error:
          "Operação desativada: defina ADMIN_RESET_SECRET ou RESET_FINANCE_SECRET no servidor.",
      });
    }
    if (!timingSafeEqualString(String(req.body?.secret ?? ""), String(secret))) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    if (req.body?.confirm !== true) {
      return res
        .status(400)
        .json({ error: "Envie JSON com confirm: true e o secret correto." });
    }

    const zerarTotal = req.body?.zerarTotal === true;
    const result = await executarResetFinanceiroLegacy(prisma, {
      tenantId: req.tenantId,
      criarAjustes: !zerarTotal,
      zerarPagamentosGerais: zerarTotal,
      zerarVendasETitulos: zerarTotal,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// GET /api/config/tenant-features — módulos habilitados (admin)
router.get("/tenant-features", requireAdmin, async (req, res) => {
  try {
    const slug = await getTenantSlug(req.tenantId);
    const features = await getTenantFeatures(prisma, req.tenantId, slug);
    res.json(features);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PUT /api/config/tenant-features — { clienteCpf?: boolean, frete?: boolean }
router.put("/tenant-features", requireAdmin, async (req, res) => {
  try {
    const { clienteCpf, frete, nfe, cte, mdfe, ciot } = req.body ?? {};
    if (clienteCpf !== undefined && typeof clienteCpf !== "boolean") {
      return res.status(400).json({ error: "clienteCpf deve ser boolean" });
    }
    if (frete !== undefined && typeof frete !== "boolean") {
      return res.status(400).json({ error: "frete deve ser boolean" });
    }
    if (nfe !== undefined && typeof nfe !== "boolean") {
      return res.status(400).json({ error: "nfe deve ser boolean" });
    }
    if (cte !== undefined && typeof cte !== "boolean") {
      return res.status(400).json({ error: "cte deve ser boolean" });
    }
    if (mdfe !== undefined && typeof mdfe !== "boolean") {
      return res.status(400).json({ error: "mdfe deve ser boolean" });
    }
    if (ciot !== undefined && typeof ciot !== "boolean") {
      return res.status(400).json({ error: "ciot deve ser boolean" });
    }
    const features = await setTenantFeatures(prisma, req.tenantId, {
      clienteCpf,
      frete,
      nfe,
      cte,
      mdfe,
      ciot,
    });
    res.json(features);
  } catch (e) {
    console.error("[config/tenant-features] falha ao gravar:", e?.code || e?.name, e?.message);
    handleRouteError(res, e);
  }
});

// GET /api/config — regras visíveis na UI
router.get("/", async (req, res) => {
  try {
    // Comissão por caixa foi descontinuada; produto usa apenas emissão.
    res.json({
      comissaoModo: "emissao",
      descricaoComissao: {
        emissao: "Comissão pela emissão da ordem (valor histórico na venda).",
      },
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PUT /api/config — ajuste de regras (protegido por JWT + tenant)
router.put("/", requireAdmin, async (req, res) => {
  try {
    const { comissaoModo } = req.body;
    if (comissaoModo != null && comissaoModo !== "emissao") {
      return res.status(400).json({
        error:
          "Modo de comissão inválido ou descontinuado. Use apenas \"emissao\".",
      });
    }
    if (comissaoModo === "emissao") {
      await setConfig(prisma, req.tenantId, "COMISSAO_MODO", "emissao");
    }
    res.json({ comissaoModo: "emissao" });
  } catch (e) {
    handleRouteError(res, e);
  }
});

const {
  prepareProvedorTokenForStorage,
  hasFiscalTokenConfigured,
  isEncryptedFiscalToken,
  encryptFiscalToken,
  getFiscalTokenKeyBytes,
} = require("../infra/crypto/fiscalTokenCrypto");

function publicEmitente(row) {
  if (!row) return null;
  const { provedorToken, ...rest } = row;
  return {
    ...rest,
    // Em ambiente multiemitente, cada CNPJ precisa da própria credencial.
    // O token global legado não deve fazer outra empresa parecer configurada.
    provedorTokenConfigurado: hasFiscalTokenConfigured(provedorToken),
  };
}

/** Lazy migration: se ainda estiver em texto puro e houver chave, regrava cifrado. */
async function maybeReencryptLegacyToken(row) {
  if (!row?.provedorToken || isEncryptedFiscalToken(row.provedorToken)) return row;
  const key = getFiscalTokenKeyBytes({ required: false });
  if (!key) return row;
  const cipher = encryptFiscalToken(String(row.provedorToken).trim(), key);
  return prisma.emitenteFiscal.update({
    where: { id: row.id },
    data: { provedorToken: cipher },
  });
}

function emitenteDataFromBody(b, tokenNovo) {
  return {
    cnpj: onlyDigits(b.cnpj),
    inscricaoEstadual: b.inscricaoEstadual,
    razaoSocial: b.razaoSocial,
    nomeFantasia: b.nomeFantasia ?? null,
    crt: b.crt,
    logradouro: b.logradouro,
    numero: b.numero,
    complemento: b.complemento ?? null,
    bairro: b.bairro,
    municipio: b.municipio,
    codigoMunicipio: b.codigoMunicipio,
    uf: b.uf,
    cep: b.cep,
    telefone: b.telefone ?? null,
    serieNfe: b.serieNfe ?? 1,
    rntrc: b.rntrc != null && String(b.rntrc).trim() ? String(b.rntrc).trim() : null,
    serieCte: b.serieCte ?? 1,
    serieMdfe: b.serieMdfe ?? 1,
    ambiente: b.ambiente,
    naturezaOperacao: b.naturezaOperacao || "Venda de mercadoria",
    modalidadeFrete: b.modalidadeFrete ?? 9,
    ativo: b.ativo ?? true,
    padrao: b.padrao ?? false,
    habilitaNfe: b.habilitaNfe ?? true,
    habilitaCte: b.habilitaCte ?? false,
    habilitaMdfe: b.habilitaMdfe ?? false,
    ...(tokenNovo !== undefined ? { provedorToken: tokenNovo } : {}),
  };
}

router.get("/emitente-fiscal", requireAdmin, async (req, res) => {
  try {
    let row = await buscarEmitenteFiscal(prisma, {
      tenantId: req.tenantId,
      recurso: null,
    });
    if (row) row = await maybeReencryptLegacyToken(row);
    res.json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put("/emitente-fiscal", requireAdmin, async (req, res) => {
  try {
    const b = parseBody(emitenteFiscalSchema, req.body);
    const atual = await buscarEmitenteFiscal(prisma, {
      tenantId: req.tenantId,
      recurso: null,
    });
    const tokenNovo =
      b.provedorToken != null && String(b.provedorToken).trim()
        ? prepareProvedorTokenForStorage(String(b.provedorToken).trim())
        : undefined;
    const data = emitenteDataFromBody(b, tokenNovo);
    data.padrao = b.padrao ?? atual?.padrao ?? true;
    let row = atual
      ? await prisma.emitenteFiscal.update({
          where: { id: atual.id },
          data,
        })
      : await prisma.emitenteFiscal.create({
          data: { tenantId: req.tenantId, ...data, padrao: true },
        });
    if (data.padrao) {
      row = await definirEmitentePadrao(prisma, {
        tenantId: req.tenantId,
        emitenteFiscalId: row.id,
      });
    }
    res.json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get("/emitentes-fiscais", requireAdmin, async (req, res) => {
  try {
    const rows = await listarEmitentesFiscais(prisma, req.tenantId);
    const migrated = await Promise.all(rows.map(maybeReencryptLegacyToken));
    res.json(migrated.map(publicEmitente));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.get("/emitentes-fiscais-opcoes", async (req, res) => {
  try {
    const recurso = ["nfe", "cte", "mdfe"].includes(String(req.query.recurso || ""))
      ? String(req.query.recurso)
      : "nfe";
    const habilitacao = {
      nfe: "habilitaNfe",
      cte: "habilitaCte",
      mdfe: "habilitaMdfe",
    }[recurso];
    const rows = await prisma.emitenteFiscal.findMany({
      where: { tenantId: req.tenantId, ativo: true, [habilitacao]: true },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        ambiente: true,
        padrao: true,
      },
      orderBy: [{ padrao: "desc" }, { razaoSocial: "asc" }],
    });
    res.json(rows);
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.post("/emitentes-fiscais", requireAdmin, async (req, res) => {
  try {
    const b = parseBody(emitenteFiscalSchema, req.body);
    const tokenNovo =
      b.provedorToken != null && String(b.provedorToken).trim()
        ? prepareProvedorTokenForStorage(String(b.provedorToken).trim())
        : undefined;
    const existentes = await prisma.emitenteFiscal.count({ where: { tenantId: req.tenantId } });
    let row = await prisma.emitenteFiscal.create({
      data: {
        tenantId: req.tenantId,
        ...emitenteDataFromBody(b, tokenNovo),
        padrao: existentes === 0 ? true : !!b.padrao,
      },
    });
    if (b.padrao && existentes > 0) {
      row = await definirEmitentePadrao(prisma, {
        tenantId: req.tenantId,
        emitenteFiscalId: row.id,
      });
    }
    res.status(201).json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put("/emitentes-fiscais/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const atual = await prisma.emitenteFiscal.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!atual) return res.status(404).json({ error: "Empresa emissora não encontrada" });
    const b = parseBody(emitenteFiscalSchema, req.body);
    if (atual.padrao && (b.padrao === false || b.ativo === false)) {
      return res.status(409).json({
        error: "Defina outra empresa como padrÃ£o antes de desativar ou desmarcar esta emissora.",
        code: "EMITENTE_PADRAO_OBRIGATORIO",
      });
    }
    const tokenNovo =
      b.provedorToken != null && String(b.provedorToken).trim()
        ? prepareProvedorTokenForStorage(String(b.provedorToken).trim())
        : undefined;
    let row = await prisma.emitenteFiscal.update({
      where: { id },
      data: emitenteDataFromBody(b, tokenNovo),
    });
    if (b.padrao) {
      row = await definirEmitentePadrao(prisma, {
        tenantId: req.tenantId,
        emitenteFiscalId: id,
      });
    }
    res.json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
