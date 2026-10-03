const { createFocusNfeProvider } = require("./focusNfeProvider");
const { createMockNfeProvider } = require("./mockNfeProvider");
const { createNotaasNfeProvider } = require("./notaasNfeProvider");
const { resolveProvedorTokenPlain } = require("../crypto/fiscalTokenCrypto");

function resolveProviderName(emitente) {
  const raw = String(process.env.NFE_PROVIDER || "").trim().toLowerCase();
  if (raw === "mock") return raw;
  const configured = String(emitente?.provedor || raw).trim().toLowerCase();
  if (configured === "focusnfe" || configured === "notaas") return configured;
  if (process.env.NODE_ENV === "test") return "mock";
  return "notaas";
}

function createNfeProvider({ emitente } = {}) {
  const name = resolveProviderName(emitente);
  if (name === "mock") return createMockNfeProvider();
  let tokenFromDb = null;
  try {
    tokenFromDb = resolveProvedorTokenPlain(emitente?.provedorToken);
  } catch {
    tokenFromDb = null;
  }
  const token =
    (tokenFromDb && String(tokenFromDb).trim()) ||
    (!emitente
      ? String(name === "notaas" ? process.env.NOTAAS_API_KEY || "" : process.env.FOCUS_NFE_TOKEN || "").trim()
      : "") ||
    null;
  if (name === "notaas") return createNotaasNfeProvider({ token });
  const ambiente =
    emitente?.ambiente || process.env.FOCUS_NFE_AMBIENTE || "homologacao";
  return createFocusNfeProvider({ token, ambiente });
}

module.exports = { createNfeProvider, resolveProviderName };
