const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAdmin } = require("../middleware/auth");
const { getConfig, setConfig, DEFAULTS } = require("../services/configSistema");
const { executarResetFinanceiroLegacy } = require("../services/resetFinanceiroLegacy");
const { handleRouteError } = require("../utils/api");

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
    if (req.body?.secret !== secret) {
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

// GET /api/config — regras visíveis na UI
router.get("/", async (req, res) => {
  try {
    const comissaoModo =
      (await getConfig(prisma, req.tenantId, "COMISSAO_MODO")) ||
      DEFAULTS.COMISSAO_MODO;
    res.json({
      comissaoModo: comissaoModo === "caixa" ? "caixa" : "emissao",
      descricaoComissao: {
        emissao: "Comissão pela emissão da ordem (valor histórico na venda).",
        caixa:
          "Comissão proporcional ao recebido na ordem (pagamentos vinculados à venda).",
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
    if (comissaoModo && !["emissao", "caixa"].includes(comissaoModo)) {
      return res.status(400).json({ error: "comissaoModo inválido" });
    }
    if (comissaoModo) {
      await setConfig(prisma, req.tenantId, "COMISSAO_MODO", comissaoModo);
    }
    const modo =
      (await getConfig(prisma, req.tenantId, "COMISSAO_MODO")) ||
      DEFAULTS.COMISSAO_MODO;
    res.json({ comissaoModo: modo });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
