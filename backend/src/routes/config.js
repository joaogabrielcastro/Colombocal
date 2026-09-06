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
    const { clienteCpf, frete, nfe } = req.body ?? {};
    if (clienteCpf !== undefined && typeof clienteCpf !== "boolean") {
      return res.status(400).json({ error: "clienteCpf deve ser boolean" });
    }
    if (frete !== undefined && typeof frete !== "boolean") {
      return res.status(400).json({ error: "frete deve ser boolean" });
    }
    if (nfe !== undefined && typeof nfe !== "boolean") {
      return res.status(400).json({ error: "nfe deve ser boolean" });
    }
    const features = await setTenantFeatures(prisma, req.tenantId, {
      clienteCpf,
      frete,
      nfe,
    });
    res.json(features);
  } catch (e) {
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

function publicEmitente(row) {
  if (!row) return null;
  const { provedorToken, ...rest } = row;
  return {
    ...rest,
    provedorTokenConfigurado: !!(
      (provedorToken && String(provedorToken).trim()) ||
      String(process.env.FOCUS_NFE_TOKEN || "").trim()
    ),
  };
}

router.get("/emitente-fiscal", requireAdmin, async (req, res) => {
  try {
    const row = await prisma.emitenteFiscal.findUnique({
      where: { tenantId: req.tenantId },
    });
    res.json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

router.put("/emitente-fiscal", requireAdmin, async (req, res) => {
  try {
    const b = parseBody(emitenteFiscalSchema, req.body);
    const atual = await prisma.emitenteFiscal.findUnique({
      where: { tenantId: req.tenantId },
    });
    const tokenNovo =
      b.provedorToken != null && String(b.provedorToken).trim()
        ? String(b.provedorToken).trim()
        : undefined;
    const data = {
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
      ambiente: b.ambiente,
      naturezaOperacao: b.naturezaOperacao || "Venda de mercadoria",
      modalidadeFrete: b.modalidadeFrete ?? 9,
      ...(tokenNovo !== undefined ? { provedorToken: tokenNovo } : {}),
    };
    const row = atual
      ? await prisma.emitenteFiscal.update({
          where: { tenantId: req.tenantId },
          data,
        })
      : await prisma.emitenteFiscal.create({
          data: { tenantId: req.tenantId, ...data },
        });
    res.json(publicEmitente(row));
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
