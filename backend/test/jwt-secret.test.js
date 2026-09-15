const test = require("node:test");
const assert = require("node:assert/strict");
const { getJwtSecret } = require("../src/middleware/auth");
const { assertProductionConfig } = require("../src/startup/assertProductionConfig");

const TEST_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

function withProdBase(fn) {
  return () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
      AUTH_DISABLED: process.env.AUTH_DISABLED,
      FISCAL_TOKEN_ENCRYPTION_KEY: process.env.FISCAL_TOKEN_ENCRYPTION_KEY,
      NFE_WEBHOOK_SECRET: process.env.NFE_WEBHOOK_SECRET,
      EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
      APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
      SMTP_HOST: process.env.SMTP_HOST,
      EMAIL_FROM: process.env.EMAIL_FROM,
      PASSWORD_RESET_ENABLED: process.env.PASSWORD_RESET_ENABLED,
    };
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "unit-test-jwt-secret-not-for-prod";
    process.env.FISCAL_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.NFE_WEBHOOK_SECRET = "unit-webhook";
    process.env.PASSWORD_RESET_ENABLED = "false";
    delete process.env.AUTH_DISABLED;
    try {
      fn();
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
}

test.describe("configuração JWT em produção", { concurrency: false }, () => {
  test("getJwtSecret falha em produção sem JWT_SECRET (sem expor valor)", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(
        () => getJwtSecret(),
        (err) => {
          assert.match(String(err.message), /JWT_SECRET é obrigatório em produção/);
          assert.equal(String(err.message).includes("dev-only"), false);
          return true;
        },
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });

  test(
    "assertProductionConfig falha em produção se AUTH_DISABLED=true",
    withProdBase(() => {
      process.env.AUTH_DISABLED = "true";
      assert.throws(() => assertProductionConfig(), /AUTH_DISABLED não é permitido/);
    }),
  );

  test(
    "assertProductionConfig exige NFE_WEBHOOK_SECRET",
    withProdBase(() => {
      delete process.env.NFE_WEBHOOK_SECRET;
      assert.throws(() => assertProductionConfig(), /NFE_WEBHOOK_SECRET/);
    }),
  );

  test(
    "assertProductionConfig exige SMTP + APP_PUBLIC_URL se reset habilitado",
    withProdBase(() => {
      process.env.PASSWORD_RESET_ENABLED = "true";
      delete process.env.APP_PUBLIC_URL;
      delete process.env.FRONTEND_URL;
      assert.throws(() => assertProductionConfig(), /APP_PUBLIC_URL/);
    }),
  );
});
