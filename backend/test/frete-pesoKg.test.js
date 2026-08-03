const test = require("node:test");
const assert = require("node:assert/strict");
const {
  freteLinha,
  calcularFreteAutomatico,
} = require("../src/domain/frete/calcularFrete");

test("freteLinha usa pesoKg quando informado", () => {
  const v = freteLinha({
    produto: { unidade: "saco", pesoKg: 8 },
    quantidade: 10,
    fretePorSaco: 5,
    fretePorTonelada: 100,
  });
  assert.equal(v, 8);
});

test("freteLinha sem pesoKg usa tarifa saco", () => {
  const v = freteLinha({
    produto: { unidade: "saco" },
    quantidade: 10,
    fretePorSaco: 1.5,
    fretePorTonelada: 100,
  });
  assert.equal(v, 15);
});

test("calcularFreteAutomatico mistura saco normal e com peso", () => {
  const mapa = new Map([
    [1, { id: 1, unidade: "saco" }],
    [2, { id: 2, unidade: "saco", pesoKg: 8 }],
  ]);
  const total = calcularFreteAutomatico(
    [
      { produtoId: 1, quantidade: 4 },
      { produtoId: 2, quantidade: 10 },
    ],
    mapa,
    2,
    100,
  );
  // 4*2 + 10*8*(100/1000) = 8 + 8 = 16
  assert.equal(total, 16);
});
