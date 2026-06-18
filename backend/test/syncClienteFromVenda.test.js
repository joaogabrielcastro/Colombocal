const test = require("node:test");
const assert = require("node:assert/strict");
const {
  moneyDiffers,
  parseAtualizarCliente,
} = require("../src/services/syncClienteFromVenda");

test("moneyDiffers: tolera centavos", () => {
  assert.equal(moneyDiffers(10, 10.005), false);
  assert.equal(moneyDiffers(10, 10.02), true);
});

test("parseAtualizarCliente: monta payload de preços e frete", () => {
  const out = parseAtualizarCliente({
    atualizarCliente: {
      precos: [{ produtoId: 3, preco: 42.5 }],
      fretePadraoSaco: 5,
      fretePadraoTonelada: 120,
    },
  });
  assert.deepEqual(out?.precos, [{ produtoId: 3, preco: 42.5 }]);
  assert.equal(out?.fretePadraoSaco, 5);
  assert.equal(out?.fretePadraoTonelada, 120);
});

test("parseAtualizarCliente: retorna null quando vazio", () => {
  assert.equal(parseAtualizarCliente({}), null);
});
