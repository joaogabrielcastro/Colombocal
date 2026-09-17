const { getJwtSecret } = require("../middleware/auth");
const { getFiscalTokenKeyBytes } = require("../infra/crypto/fiscalTokenCrypto");
const { assertSmtpConfig, resolveTransport } = require("../infra/email/emailService");

function passwordResetEnabled() {
  return process.env.PASSWORD_RESET_ENABLED !== "false";
}

/**
 * Falha rápido em produção se a configuração crítica estiver ausente.
 * Não registra o valor de nenhum secret.
 */
function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;

  getJwtSecret();
  getFiscalTokenKeyBytes({ required: true });

  if (process.env.AUTH_DISABLED === "true") {
    throw new Error(
      "AUTH_DISABLED não é permitido em produção. A API exige autenticação JWT.",
    );
  }

  if (!String(process.env.NFE_WEBHOOK_SECRET || "").trim()) {
    throw new Error(
      "NFE_WEBHOOK_SECRET é obrigatório em produção (webhooks de NF-e).",
    );
  }

  if (String(process.env.CIOT_PROVIDER || "").trim().toLowerCase() === "mock") {
    throw new Error(
      "CIOT_PROVIDER=mock não é permitido em produção.",
    );
  }

  if (passwordResetEnabled()) {
    const appUrl = String(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || "").trim();
    if (!appUrl) {
      throw new Error(
        "APP_PUBLIC_URL (ou FRONTEND_URL) é obrigatório em produção quando a recuperação de senha está habilitada.",
      );
    }
    if (resolveTransport() !== "smtp") {
      throw new Error(
        "EMAIL_TRANSPORT=smtp é obrigatório em produção quando a recuperação de senha está habilitada.",
      );
    }
    assertSmtpConfig();
  } else if (resolveTransport() === "smtp") {
    assertSmtpConfig();
  }
}

module.exports = { assertProductionConfig, passwordResetEnabled };
