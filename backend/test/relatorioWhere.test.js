const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVendasWhere,
  buildTitulosWhere,
  buildItemProdutoFilter,
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

test("buildVendasWhere filtra por produtoId", () => {
  const where = buildVendasWhere({ produtoId: "9" }, 1);
  assert.deepEqual(where.itens, { some: { produtoId: 9 } });
});

test("buildVendasWhere filtra por produtoBusca (nome parcial)", () => {
  const where = buildVendasWhere({ produtoBusca: "  dolomita  " }, 1);
  assert.deepEqual(where.itens, {
    some: { produto: { nome: { contains: "dolomita", mode: "insensitive" } } },
  });
});

test("buildVendasWhere combina produtoId e produtoBusca", () => {
  const where = buildVendasWhere({ produtoId: "3", produtoBusca: "cal" }, 1);
  assert.deepEqual(where.itens, {
    some: {
      produtoId: 3,
      produto: { nome: { contains: "cal", mode: "insensitive" } },
    },
  });
});

test("buildItemProdutoFilter retorna null sem filtros", () => {
  assert.equal(buildItemProdutoFilter({}), null);
  assert.equal(buildItemProdutoFilter({ produtoId: "", produtoBusca: "  " }), null);
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
