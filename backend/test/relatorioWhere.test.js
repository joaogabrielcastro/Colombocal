const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVendasWhere } = require("../src/utils/relatorioWhere");

test("buildVendasWhere aplica motoristaId", () => {
  const where = buildVendasWhere({ motoristaId: "12" }, 1);
  assert.equal(where.tenantId, 1);
  assert.equal(where.motoristaId, 12);
});

test("buildVendasWhere ignora motorista vazio", () => {
  const where = buildVendasWhere({ motoristaId: "" }, 1);
  assert.equal(where.motoristaId, undefined);
});
