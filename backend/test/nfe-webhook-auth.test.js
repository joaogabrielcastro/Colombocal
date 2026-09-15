const test = require("node:test");
const assert = require("node:assert/strict");
const { webhookSecretOk } = require("../src/routes/webhooksNfe");

function fakeReq({ header, query } = {}) {
  return {
    headers: header ? { "x-webhook-token": header } : {},
    query: query ? { token: query } : {},
  };
}

test.describe("auth do webhook NF-e", { concurrency: false }, () => {
  test("em produção recusa chamada sem NFE_WEBHOOK_SECRET", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.NFE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.NFE_WEBHOOK_SECRET;
    try {
      assert.equal(webhookSecretOk(fakeReq({ header: "qualquer" })), false);
      assert.equal(webhookSecretOk(fakeReq()), false);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.NFE_WEBHOOK_SECRET;
      else process.env.NFE_WEBHOOK_SECRET = prevSecret;
    }
  });

  test("aceita token no header quando o secret está definido", () => {
    const prevSecret = process.env.NFE_WEBHOOK_SECRET;
    process.env.NFE_WEBHOOK_SECRET = "hook-unit-secret";
    try {
      assert.equal(webhookSecretOk(fakeReq({ header: "hook-unit-secret" })), true);
      assert.equal(webhookSecretOk(fakeReq({ header: "errado" })), false);
      assert.equal(webhookSecretOk(fakeReq({ query: "hook-unit-secret" })), true);
    } finally {
      if (prevSecret === undefined) delete process.env.NFE_WEBHOOK_SECRET;
      else process.env.NFE_WEBHOOK_SECRET = prevSecret;
    }
  });
});
