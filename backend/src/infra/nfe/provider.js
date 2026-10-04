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
  // Produção atual = Focus; Nôtaas só quando emitente/env apontar explicitamente.
  return "focusnfe";
}

function envTokenForProvider(name) {
  if (name === "notaas") {
    return String(process.env.NOTAAS_API_KEY || "").trim();
  }
  return String(process.env.FOCUS_NFE_TOKEN || "").trim();
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
  // Token do emitente primeiro; env como fallback (não quebra prod que ainda usa FOCUS_NFE_TOKEN).
  const token =
    (tokenFromDb && String(tokenFromDb).trim()) || envTokenForProvider(name) || null;
  if (name === "notaas") return createNotaasNfeProvider({ token });
  const ambiente =
    emitente?.ambiente || process.env.FOCUS_NFE_AMBIENTE || "homologacao";
  return createFocusNfeProvider({ token, ambiente });
}

module.exports = { createNfeProvider, resolveProviderName };
