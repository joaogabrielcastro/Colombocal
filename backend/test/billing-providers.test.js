const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createMockBillingProvider } = require("../src/infra/billing/mockBillingProvider");
const { createBradescoBillingProvider } = require("../src/infra/billing/bradescoBillingProvider");
const { createSicrediBillingProvider } = require("../src/infra/billing/sicrediBillingProvider");
const { createBankBillingProvider } = require("../src/infra/billing/provider");
const { BankBillingError, CODES } = require("../src/infra/billing/errors");
const { assertProductionConfig } = require("../src/startup/assertProductionConfig");

describe("billing providers", () => {
  it("mock gera cobrança com linha digitável", async () => {
    const p = createMockBillingProvider({ banco: "BRADESCO" });
    const r = await p.gerarCobranca({
      tituloId: 123,
      idempotencyKey: "cobranca:titulo:123",
      valor: 100,
    });
    assert.ok(r.linhaDigitavel);
    assert.ok(r.codigoBarras);
    assert.equal(r.status, "DISPONIVEL");
    assert.ok(r.pdfRef);
  });

  it("mock timeout via override", async () => {
    const p = createMockBillingProvider({
      overrides: {
        async gerarCobranca() {
          throw new BankBillingError("timeout", {
            code: CODES.TIMEOUT,
            retryable: true,
          });
        },
      },
    });
    await assert.rejects(() => p.gerarCobranca({ tituloId: 1 }), (err) => {
      assert.equal(err.code, CODES.TIMEOUT);
      return true;
    });
  });

  for (const status of [400, 401, 403, 429, 500]) {
    it(`mock erro HTTP ${status}`, async () => {
      const { mapHttpStatusToBankError } = require("../src/infra/billing/errors");
      const err = mapHttpStatusToBankError(status, `erro ${status}`);
      assert.ok(err instanceof BankBillingError);
      assert.ok(err.code);
    });
  }

  it("Bradesco sem config → NOT_CONFIGURED", async () => {
    const p = createBradescoBillingProvider({ config: { status: "NAO_CONFIGURADO" } });
    await assert.rejects(() => p.gerarCobranca({}), (err) => {
      assert.equal(err.code, CODES.NOT_CONFIGURED);
      return true;
    });
  });

  it("Sicredi sem config → NOT_CONFIGURED", async () => {
    const p = createSicrediBillingProvider({ config: { status: "NAO_CONFIGURADO" } });
    await assert.rejects(() => p.gerarCobranca({}), (err) => {
      assert.equal(err.code, CODES.NOT_CONFIGURED);
      return true;
    });
  });

  it("factory usa mock em NODE_ENV=test", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    delete process.env.BRADESCO_PROVIDER;
    const p = createBankBillingProvider({ banco: "BRADESCO" });
    assert.equal(p.name, "mock");
    process.env.NODE_ENV = prev;
  });
});

describe("assertProductionConfig billing mocks", () => {
  it("bloqueia BRADESCO_PROVIDER=mock em produção", () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      BRADESCO_PROVIDER: process.env.BRADESCO_PROVIDER,
      JWT_SECRET: process.env.JWT_SECRET,
      FISCAL_TOKEN_ENCRYPTION_KEY: process.env.FISCAL_TOKEN_ENCRYPTION_KEY,
      NFE_WEBHOOK_SECRET: process.env.NFE_WEBHOOK_SECRET,
      PASSWORD_RESET_ENABLED: process.env.PASSWORD_RESET_ENABLED,
    };
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.FISCAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.NFE_WEBHOOK_SECRET = "whsec";
    process.env.PASSWORD_RESET_ENABLED = "false";
    process.env.BRADESCO_PROVIDER = "mock";
    assert.throws(() => assertProductionConfig(), /BRADESCO_PROVIDER=mock/);
    Object.assign(process.env, prev);
  });

  it("bloqueia SICREDI_PROVIDER=mock em produção", () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      SICREDI_PROVIDER: process.env.SICREDI_PROVIDER,
      BRADESCO_PROVIDER: process.env.BRADESCO_PROVIDER,
      JWT_SECRET: process.env.JWT_SECRET,
      FISCAL_TOKEN_ENCRYPTION_KEY: process.env.FISCAL_TOKEN_ENCRYPTION_KEY,
      NFE_WEBHOOK_SECRET: process.env.NFE_WEBHOOK_SECRET,
      PASSWORD_RESET_ENABLED: process.env.PASSWORD_RESET_ENABLED,
    };
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.FISCAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.NFE_WEBHOOK_SECRET = "whsec";
    process.env.PASSWORD_RESET_ENABLED = "false";
    delete process.env.BRADESCO_PROVIDER;
    process.env.SICREDI_PROVIDER = "mock";
    assert.throws(() => assertProductionConfig(), /SICREDI_PROVIDER=mock/);
    Object.assign(process.env, prev);
  });
});
