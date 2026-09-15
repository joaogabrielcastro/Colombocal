/**
 * Backfill unitário: ciphertext legado → cifrar é idempotente.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const {
  encryptFiscalToken,
  isEncryptedFiscalToken,
  decryptFiscalToken,
} = require("../src/infra/crypto/fiscalTokenCrypto");

describe("fiscal token backfill idempotência", () => {
  const key = crypto.randomBytes(32);

  it("re-cifrar já cifrado não é necessário (detecta formato)", () => {
    const first = encryptFiscalToken("abc", key);
    assert.ok(isEncryptedFiscalToken(first));
    assert.equal(decryptFiscalToken(first, key), "abc");
    // Segunda passagem do script pula isEncryptedFiscalToken
    assert.equal(isEncryptedFiscalToken(first), true);
  });
});
