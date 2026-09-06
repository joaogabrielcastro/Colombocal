const { createFocusNfeProvider } = require("./focusNfeProvider");
const { createMockNfeProvider } = require("./mockNfeProvider");

function resolveProviderName() {
  const raw = String(process.env.NFE_PROVIDER || "").trim().toLowerCase();
  if (raw === "mock" || raw === "focusnfe") return raw;
  if (process.env.NODE_ENV === "test") return "mock";
  return "focusnfe";
}

function createNfeProvider({ emitente } = {}) {
  const name = resolveProviderName();
  if (name === "mock") return createMockNfeProvider();
  const token =
    (emitente?.provedorToken && String(emitente.provedorToken).trim()) ||
    String(process.env.FOCUS_NFE_TOKEN || "").trim() ||
    null;
  const ambiente =
    emitente?.ambiente || process.env.FOCUS_NFE_AMBIENTE || "homologacao";
  return createFocusNfeProvider({ token, ambiente });
}

module.exports = { createNfeProvider, resolveProviderName };
