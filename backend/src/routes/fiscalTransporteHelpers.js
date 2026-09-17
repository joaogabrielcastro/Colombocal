const { prisma } = require("../lib/prisma");
const { AppError } = require("../shared/errors/appError");
const { getTenantFeatures } = require("../services/tenantFeaturesResolver");
const { getTenantSlug } = require("../utils/tenantRequest");
const { timingSafeEqualString } = require("../utils/setupSecret");

async function assertFeatureEnabled(req, featureKey, code, label) {
  const slug = await getTenantSlug(req.tenantId);
  const features = await getTenantFeatures(prisma, req.tenantId, slug);
  if (!features[featureKey]) {
    throw new AppError(`Módulo ${label} desabilitado para este tenant.`, {
      code,
      httpStatus: 403,
    });
  }
  return features;
}

async function assertCteEnabled(req) {
  return assertFeatureEnabled(req, "cte", "CTE_DESABILITADO", "CT-e");
}

async function assertMdfeEnabled(req) {
  return assertFeatureEnabled(req, "mdfe", "MDFE_DESABILITADO", "MDF-e");
}

async function assertCiotEnabled(req) {
  return assertFeatureEnabled(req, "ciot", "CIOT_DESABILITADO", "CIOT");
}

function fiscalWebhookSecretOk(req) {
  const expected = String(
    process.env.FISCAL_WEBHOOK_SECRET || process.env.NFE_WEBHOOK_SECRET || "",
  ).trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const header =
    req.headers["x-webhook-token"] ||
    req.headers["x-nfe-token"] ||
    req.headers["x-fiscal-token"] ||
    "";
  const query = req.query?.token || "";
  return (
    timingSafeEqualString(String(header), expected) ||
    timingSafeEqualString(String(query), expected)
  );
}

module.exports = {
  assertCteEnabled,
  assertMdfeEnabled,
  assertCiotEnabled,
  fiscalWebhookSecretOk,
};
