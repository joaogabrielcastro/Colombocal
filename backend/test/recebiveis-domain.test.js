const test = require("node:test");
const assert = require("node:assert/strict");
const { EPS } = require("../src/domain/financeiro/recebiveis");

test("EPS usado como tolerância de centavos", () => {
  assert.ok(EPS < 0.02);
  assert.ok(EPS > 0);
});
