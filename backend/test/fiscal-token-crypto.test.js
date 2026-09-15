const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const {
  encryptFiscalToken,
  decryptFiscalToken,
  isEncryptedFiscalToken,
  prepareProvedorTokenForStorage,
  resolveProvedorTokenPlain,
} = require("../src/infra/crypto/fiscalTokenCrypto");

const KEY = crypto.randomBytes(32);

describe("fiscalTokenCrypto", () => {
  const prev = process.env.FISCAL_TOKEN_ENCRYPTION_KEY;
  before(() => {
    process.env.FISCAL_TOKEN_ENCRYPTION_KEY = KEY.toString("base64");
  });
  after(() => {
    if (prev == null) delete process.env.FISCAL_TOKEN_ENCRYPTION_KEY;
    else process.env.FISCAL_TOKEN_ENCRYPTION_KEY = prev;
  });

  it("criptografa e descriptografa o valor original", () => {
    const plain = "token-secreto-focus-xyz";
    const enc = encryptFiscalToken(plain);
    assert.ok(isEncryptedFiscalToken(enc));
    assert.notEqual(enc, plain);
    assert.equal(decryptFiscalToken(enc), plain);
  });

  it("IV diferente produz ciphertext diferente", () => {
    const plain = "mesmo-token";
    const a = encryptFiscalToken(plain);
    const b = encryptFiscalToken(plain);
    assert.notEqual(a, b);
    assert.equal(decryptFiscalToken(a), plain);
    assert.equal(decryptFiscalToken(b), plain);
  });

  it("chave errada falha", () => {
    const enc = encryptFiscalToken("abc");
    const wrong = crypto.randomBytes(32);
    assert.throws(() => decryptFiscalToken(enc, wrong));
  });

  it("ciphertext alterado falha", () => {
    const enc = encryptFiscalToken("abc");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    assert.throws(() => decryptFiscalToken(parts.join(":")));
  });

  it("formato inválido falha", () => {
    assert.throws(() => decryptFiscalToken("v1:only:two"));
    assert.throws(() => decryptFiscalToken("v2:a:b:c"));
  });

  it("legado plaintext é lido e prepare cifra para storage", () => {
    assert.equal(resolveProvedorTokenPlain("legado-plain"), "legado-plain");
    const stored = prepareProvedorTokenForStorage("novo");
    assert.ok(isEncryptedFiscalToken(stored));
    assert.equal(resolveProvedorTokenPlain(stored), "novo");
  });

  it("não inclui o plaintext no ciphertext serializado", () => {
    const plain = "nao-aparecer-no-blob";
    const enc = encryptFiscalToken(plain);
    assert.ok(!enc.includes(plain));
  });
});
