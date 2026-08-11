const test = require("node:test");
const assert = require("node:assert/strict");
const {
  freteLinha,
  calcularFreteAutomatico,
  freteUnitarioPorPeso,
} = require("../src/domain/frete/calcularFrete");

test("freteLinha com pesoKg prioriza frete/saco mesmo com frete/ton preenchido", () => {
  // Evita o bug: frete/t = 2.50 (mesmo nº do saco) → 0,02/saco
  const unit = freteUnitarioPorPeso(8, 2.5, 2.5);
  assert.equal(unit, 1); // 2.5 × 8/20
  const v = freteLinha({
    produto: { unidade: "saco", pesoKg: 8 },
    quantidade: 10,
    fretePorSaco: 2.5,
    fretePorTonelada: 2.5,
  });
  assert.equal(v, 10);
});

test("freteLinha com pesoKg e frete/saco=0 usa frete/ton", () => {
  const v = freteLinha({
    produto: { unidade: "saco", pesoKg: 8 },
    quantidade: 10,
    fretePorSaco: 0,
    fretePorTonelada: 100,
  });
  assert.equal(v, 8); // 10 × 8 × 0.1
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

test("freteLinha arredonda para 2 casas", () => {
  const v = freteLinha({
    produto: { unidade: "saco", pesoKg: 7 },
    quantidade: 3,
    fretePorSaco: 2.5,
    fretePorTonelada: 0,
  });
  // 3 × 2.5 × 7/20 = 2.625 → 2.63
  assert.equal(v, 2.63);
});

test("freteLinha aceita unidade SAC", () => {
  const v = freteLinha({
    produto: { unidade: "SAC" },
    quantidade: 4,
    fretePorSaco: 1.25,
    fretePorTonelada: 0,
  });
  assert.equal(v, 5);
});

test("calcularFreteAutomatico mistura saco normal e pintura com frete/saco", () => {
  const mapa = new Map([
    [1, { id: 1, unidade: "saco" }],
    [2, { id: 2, unidade: "saco", pesoKg: 8 }],
  ]);
  const total = calcularFreteAutomatico(
    [
      { produtoId: 1, quantidade: 252 },
      { produtoId: 2, quantidade: 150 },
    ],
    mapa,
    2.5,
    0,
  );
  // 252*2.5 + 150*(2.5*8/20) = 630 + 150 = 780
  assert.equal(total, 780);
});
