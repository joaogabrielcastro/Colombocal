const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { registrarRecebimentoComposto } = require("../application/use-cases/registrarRecebimentoComposto");
const { parseBody } = require("../utils/zodParse");
const { recebimentoCompostoSchema } = require("../schemas/recebimento");
const { handleRouteError } = require("../utils/api");
const { actorFromReq } = require("../services/financeiroEventos");

// POST /api/recebimentos — cheques + dinheiro + PIX numa única operação
router.post("/", async (req, res) => {
  try {
    const b = parseBody(recebimentoCompostoSchema, req.body);
    const result = await registrarRecebimentoComposto(prisma, {
      ...b,
      tenantId: req.tenantId,
      auditActor: actorFromReq(req),
    });
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
