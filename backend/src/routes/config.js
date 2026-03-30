const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { getConfig, setConfig, DEFAULTS } = require("../services/configSistema");
const { handleRouteError } = require("../utils/api");


// GET /api/config — regras visíveis na UI
router.get("/", async (req, res) => {
  try {
    const comissaoModo = (await getConfig(prisma, "COMISSAO_MODO")) || DEFAULTS.COMISSAO_MODO;
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

// PUT /api/config — ajuste de regras (sem auth por enquanto)
router.put("/", async (req, res) => {
  try {
    const { comissaoModo } = req.body;
    if (comissaoModo && !["emissao", "caixa"].includes(comissaoModo)) {
      return res.status(400).json({ error: "comissaoModo inválido" });
    }
    if (comissaoModo) {
      await setConfig(prisma, "COMISSAO_MODO", comissaoModo);
    }
    const modo = (await getConfig(prisma, "COMISSAO_MODO")) || DEFAULTS.COMISSAO_MODO;
    res.json({ comissaoModo: modo });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
