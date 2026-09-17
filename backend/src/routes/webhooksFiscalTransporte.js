const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError } = require("../utils/api");
const { fiscalWebhookSecretOk } = require("./fiscalTransporteHelpers");
const { aplicarWebhookCte } = require("../application/use-cases/gerirCte");
const { aplicarWebhookMdfe } = require("../application/use-cases/gerirMdfe");

function makeWebhook(aplicar) {
  return async (req, res) => {
    try {
      if (!fiscalWebhookSecretOk(req)) {
        return res.status(401).json({ error: "Webhook não autorizado" });
      }
      const body = req.body || {};
      const ref = body.ref || body.refProvedor || req.query.ref;
      const doc = await aplicar(prisma, { ref, body });
      res.json({ ok: true, id: doc.id, status: doc.status });
    } catch (error) {
      handleRouteError(res, error);
    }
  };
}

const cteRouter = express.Router();
cteRouter.post("/", makeWebhook(aplicarWebhookCte));

const mdfeRouter = express.Router();
mdfeRouter.post("/", makeWebhook(aplicarWebhookMdfe));

module.exports = { cteRouter, mdfeRouter };
