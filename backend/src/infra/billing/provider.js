const { createMockBillingProvider } = require("./mockBillingProvider");
const { createBradescoBillingProvider } = require("./bradescoBillingProvider");
const { createSicrediBillingProvider } = require("./sicrediBillingProvider");

function resolveBillingProviderName(banco) {
  const b = String(banco || "").trim().toUpperCase();
  const envKey = b === "BRADESCO" ? "BRADESCO_PROVIDER" : "SICREDI_PROVIDER";
  const raw = String(process.env[envKey] || "").trim().toLowerCase();
  if (raw === "mock" || raw === "api") return raw;
  if (process.env.NODE_ENV === "test") return "mock";
  return "api";
}

/**
 * Factory de provider de cobrança bancária.
 * @param {{ banco: string, config?: object, secrets?: object, overrides?: object }} opts
 */
function createBankBillingProvider({ banco, config, secrets, overrides } = {}) {
  const b = String(banco || "").trim().toUpperCase();
  const name = resolveBillingProviderName(b);

  if (name === "mock") {
    return createMockBillingProvider({ banco: b || "MOCK", overrides });
  }

  if (b === "BRADESCO") {
    return createBradescoBillingProvider({ config, secrets });
  }
  if (b === "SICREDI") {
    return createSicrediBillingProvider({ config, secrets });
  }

  return createMockBillingProvider({ banco: b || "MOCK", overrides });
}

module.exports = {
  createBankBillingProvider,
  resolveBillingProviderName,
};
