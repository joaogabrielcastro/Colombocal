const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVendasWhere,
  buildTitulosWhere,
} = require("../src/utils/relatorioWhere");

test("buildVendasWhere aplica motoristaId", () => {
  const where = buildVendasWhere({ motoristaId: "12" }, 1);
  assert.equal(where.tenantId, 1);
  assert.equal(where.motoristaId, 12);
});

test("buildVendasWhere ignora motorista vazio", () => {
  const where = buildVendasWhere({ motoristaId: "" }, 1);
  assert.equal(where.motoristaId, undefined);
});

test("buildTitulosWhere filtra por id interno ou numeroVenda", () => {
  const where = buildTitulosWhere({ vendaId: "11" }, 1);
  assert.equal(where.tenantId, 1);
  assert.deepEqual(where.OR, [
    { vendaId: 11 },
    { venda: { numeroVenda: 11 } },
  ]);
});

test("buildTitulosWhere aceita # na ordem", () => {
  const where = buildTitulosWhere({ vendaId: "#11" }, 1);
  assert.deepEqual(where.OR, [
    { vendaId: 11 },
    { venda: { numeroVenda: 11 } },
  ]);
});
