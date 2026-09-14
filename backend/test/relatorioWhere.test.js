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

test("buildTitulosWhere filtra por representante", () => {
  const where = buildTitulosWhere({ vendedorId: "7" }, 1);
  assert.equal(where.tenantId, 1);
  assert.deepEqual(where.AND, [
    {
      OR: [
        { venda: { vendedorId: 7 } },
        { cliente: { vendedorId: 7 } },
      ],
    },
  ]);
});

test("buildTitulosWhere ignora vendedor vazio", () => {
  const where = buildTitulosWhere({ vendedorId: "" }, 1);
  assert.equal(where.AND, undefined);
});

test("tituloFiltroVendedor retorna null para id inválido", () => {
  const { tituloFiltroVendedor } = require("../src/utils/relatorioWhere");
  assert.equal(tituloFiltroVendedor(""), null);
  assert.equal(tituloFiltroVendedor("0"), null);
  assert.equal(tituloFiltroVendedor("abc"), null);
});

test("buildTitulosWhere aplica situacao vencidos no mesmo corte do aging", () => {
  const where = buildTitulosWhere({ situacao: "vencidos", vendedorId: "7" }, 1);
  assert.equal(where.tenantId, 1);
  assert.equal(where.AND.length, 2);
  assert.ok(where.AND[1].vencimento.lt);
});

test("buildTitulosWhere aplica situacao a_vencer", () => {
  const where = buildTitulosWhere({ situacao: "a_vencer" }, 1);
  assert.ok(where.AND[0].vencimento.gte);
});

test("buildTitulosWhere ignora situacao inválida", () => {
  const where = buildTitulosWhere({ situacao: "inventado" }, 1);
  assert.equal(where.AND, undefined);
});

test("buildTitulosWhere combina somenteEmAberto com situacao", () => {
  const where = buildTitulosWhere(
    { somenteEmAberto: "true", situacao: "vencidos" },
    2,
  );
  assert.equal(where.tenantId, 2);
  assert.deepEqual(where.status, { in: ["aberto", "parcial"] });
  assert.ok(where.AND[0].vencimento.lt);
});
