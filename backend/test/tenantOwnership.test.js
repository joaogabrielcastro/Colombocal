const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertClienteDoTenant,
  assertVendaDoTenant,
  assertProdutosDoTenant,
} = require("../src/utils/tenantOwnership");

function makeTx({ cliente = null, venda = null, produtoCount = 0 } = {}) {
  return {
    cliente: { findFirst: async () => cliente },
    venda: { findFirst: async () => venda },
    produto: { count: async () => produtoCount },
  };
}

// assertClienteDoTenant
test("assertClienteDoTenant: lança 400 quando clienteId ausente", async () => {
  await assert.rejects(
    () => assertClienteDoTenant(makeTx(), null, 1),
    (e) => e.httpStatus === 400 && e.code === "CLIENTE_REQUIRED",
  );
});

test("assertClienteDoTenant: lança 404 quando não encontrado", async () => {
  await assert.rejects(
    () => assertClienteDoTenant(makeTx({ cliente: null }), 5, 1),
    (e) => e.httpStatus === 404 && e.code === "CLIENTE_NAO_ENCONTRADO",
  );
});

test("assertClienteDoTenant: passa quando encontrado", async () => {
  await assertClienteDoTenant(makeTx({ cliente: { id: 5 } }), 5, 1);
});

// assertVendaDoTenant
test("assertVendaDoTenant: ignora quando vendaId é null", async () => {
  await assertVendaDoTenant(makeTx(), null, 1);
});

test("assertVendaDoTenant: lança 404 quando venda não existe", async () => {
  await assert.rejects(
    () => assertVendaDoTenant(makeTx({ venda: null }), 9, 1),
    (e) => e.httpStatus === 404 && e.code === "VENDA_NAO_ENCONTRADA",
  );
});

test("assertVendaDoTenant: lança 400 quando venda é de outro cliente", async () => {
  await assert.rejects(
    () => assertVendaDoTenant(makeTx({ venda: { id: 9, clienteId: 2 } }), 9, 1, { clienteId: 3 }),
    (e) => e.httpStatus === 400 && e.code === "VENDA_CLIENTE_INVALIDO",
  );
});

test("assertVendaDoTenant: passa quando venda pertence ao cliente", async () => {
  await assertVendaDoTenant(makeTx({ venda: { id: 9, clienteId: 3 } }), 9, 1, { clienteId: 3 });
});

// assertProdutosDoTenant
test("assertProdutosDoTenant: não faz nada com lista vazia/ inválida", async () => {
  await assertProdutosDoTenant(makeTx(), [], 1);
  await assertProdutosDoTenant(makeTx(), [0, -1, NaN], 1);
});

test("assertProdutosDoTenant: lança 404 quando faltam produtos", async () => {
  await assert.rejects(
    () => assertProdutosDoTenant(makeTx({ produtoCount: 1 }), [1, 2], 1),
    (e) => e.httpStatus === 404 && e.code === "PRODUTO_NAO_ENCONTRADO",
  );
});

test("assertProdutosDoTenant: passa quando todos existem (dedup)", async () => {
  await assertProdutosDoTenant(makeTx({ produtoCount: 2 }), [1, 2, 2, 1], 1);
});
