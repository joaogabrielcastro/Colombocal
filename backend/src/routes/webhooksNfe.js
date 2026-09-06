const express = require("express");
const router = express.Router();
const { timingSafeEqualString } = require("../utils/setupSecret");
const { aplicarWebhookNfe } = require("../application/use-cases/gerirNfe");
const { prisma } = require("../lib/prisma");
const { handleRouteError } = require("../utils/api");

function webhookSecretOk(req) {
  const expected = String(process.env.NFE_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const header =
    req.headers["x-webhook-token"] ||
    req.headers["x-nfe-token"] ||
    "";
  const query = req.query?.token || "";
  return (
    timingSafeEqualString(String(header), expected) ||
    timingSafeEqualString(String(query), expected)
  );
}

router.post("/", async (req, res) => {
  try {
    if (!webhookSecretOk(req)) {
      return res.status(401).json({ error: "Webhook não autorizado" });
    }
    const body = req.body || {};
    const ref = body.ref || body.refProvedor || req.query.ref;
    const nota = await aplicarWebhookNfe(prisma, { ref, body });
    res.json({ ok: true, id: nota.id, status: nota.status });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
