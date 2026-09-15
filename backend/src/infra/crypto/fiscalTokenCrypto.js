const crypto = require("crypto");

const PREFIX = "v1";
const KEY_ENV = "FISCAL_TOKEN_ENCRYPTION_KEY";

/**
 * Chave AES-256: 32 bytes em base64 ou hex (64 hex chars).
 * Em produção é obrigatória (assertProductionConfig).
 */
function getFiscalTokenKeyBytes({ required = false } = {}) {
  const raw = String(process.env[KEY_ENV] || "").trim();
  if (!raw) {
    if (required || process.env.NODE_ENV === "production") {
      throw new Error(`${KEY_ENV} é obrigatória em produção`);
    }
    return null;
  }
  let buf;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, "hex");
  } else {
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      throw new Error(`${KEY_ENV} inválida (use base64 de 32 bytes ou hex de 64 chars)`);
    }
  }
  if (buf.length !== 32) {
    throw new Error(`${KEY_ENV} deve ter exatamente 32 bytes (AES-256)`);
  }
  return buf;
}

function isEncryptedFiscalToken(value) {
  if (value == null) return false;
  const s = String(value);
  return s.startsWith(`${PREFIX}:`) && s.split(":").length === 4;
}

/**
 * AES-256-GCM. Formato: v1:ivB64:tagB64:cipherB64
 */
function encryptFiscalToken(plaintext, keyBytes) {
  const plain = String(plaintext ?? "");
  if (!plain) return null;
  const key = keyBytes || getFiscalTokenKeyBytes({ required: true });
  if (!key) {
    throw new Error(`${KEY_ENV} não configurada`);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

function decryptFiscalToken(stored, keyBytes) {
  if (stored == null || stored === "") return null;
  const s = String(stored);
  if (/^v\d+:/.test(s) && !isEncryptedFiscalToken(s)) {
    throw new Error("Formato de token fiscal criptografado inválido");
  }
  if (!isEncryptedFiscalToken(s)) {
    // Legado em texto puro — só para migração/lazy decrypt no backend.
    return s;
  }
  const key = keyBytes || getFiscalTokenKeyBytes({ required: true });
  if (!key) {
    throw new Error(`${KEY_ENV} não configurada para descriptografar token fiscal`);
  }
  const parts = s.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Formato de token fiscal criptografado inválido");
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  let iv, tag, data;
  try {
    iv = Buffer.from(ivB64, "base64");
    tag = Buffer.from(tagB64, "base64");
    data = Buffer.from(cipherB64, "base64");
  } catch {
    throw new Error("Formato de token fiscal criptografado inválido");
  }
  if (iv.length !== 12 || tag.length !== 16 || data.length < 1) {
    throw new Error("Formato de token fiscal criptografado inválido");
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Falha ao descriptografar token fiscal (chave ou ciphertext inválidos)");
  }
}

/**
 * Token pronto para o provedor: descriptografa se necessário.
 * Não logar o retorno.
 */
function resolveProvedorTokenPlain(stored) {
  if (stored == null || !String(stored).trim()) return null;
  return decryptFiscalToken(String(stored).trim());
}

/**
 * Para persistência: criptografa se houver chave; em test/dev sem chave
 * mantém plaintext apenas se NODE_ENV !== production (assert já bloqueia prod).
 */
function prepareProvedorTokenForStorage(plaintext) {
  const plain = plaintext != null ? String(plaintext).trim() : "";
  if (!plain) return null;
  const key = getFiscalTokenKeyBytes({ required: false });
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${KEY_ENV} é obrigatória em produção`);
    }
    return plain;
  }
  return encryptFiscalToken(plain, key);
}

function hasFiscalTokenConfigured(stored) {
  return !!(stored && String(stored).trim());
}

module.exports = {
  KEY_ENV,
  PREFIX,
  getFiscalTokenKeyBytes,
  isEncryptedFiscalToken,
  encryptFiscalToken,
  decryptFiscalToken,
  resolveProvedorTokenPlain,
  prepareProvedorTokenForStorage,
  hasFiscalTokenConfigured,
};
