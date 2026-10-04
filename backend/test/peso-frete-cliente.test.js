const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toPesoPositivo,
  produtoComPesoFrete,
  aplicarPesoFreteNoMap,
} = require("../src/domain/frete/pesoFreteCliente");
const { freteLinha } = require("../src/domain/frete/calcularFrete");

test("toPesoPositivo aceita só peso > 0", () => {
  assert.equal(toPesoPositivo(10), 10);
  assert.equal(toPesoPositivo("8,5"), 8.5);
  assert.equal(toPesoPositivo(0), null);
  assert.equal(toPesoPositivo(-1), null);
  assert.equal(toPesoPositivo(""), null);
  assert.equal(toPesoPositivo(null), null);
});

test("produtoComPesoFrete sobrescreve pesoKg só no frete", () => {
  const produto = { id: 1, unidade: "saco", pesoKg: 8 };
  const map = new Map([[1, 10]]);
  const comOverride = produtoComPesoFrete(produto, map);
  assert.equal(comOverride.pesoKg, 10);
  assert.equal(produto.pesoKg, 8);
  assert.equal(produtoComPesoFrete(produto, new Map()).pesoKg, 8);
});

test("aplicarPesoFreteNoMap altera o map para cálculo", () => {
  const produtosPorId = new Map([
    [1, { id: 1, unidade: "saco", pesoKg: 8 }],
    [2, { id: 2, unidade: "saco", pesoKg: 20 }],
  ]);
  aplicarPesoFreteNoMap(produtosPorId, new Map([[1, 10]]));
  assert.equal(produtosPorId.get(1).pesoKg, 10);
  assert.equal(produtosPorId.get(2).pesoKg, 20);
});

test("freteLinha com peso override 8→10 aumenta o frete", () => {
  const base = freteLinha({
    produto: { unidade: "saco", pesoKg: 8 },
    quantidade: 10,
    fretePorSaco: 2.5,
    fretePorTonelada: 0,
  });
  const override = freteLinha({
    produto: { unidade: "saco", pesoKg: 10 },
    quantidade: 10,
    fretePorSaco: 2.5,
    fretePorTonelada: 0,
  });
  // 10 × (2.5 × 8/20) = 10
  assert.equal(base, 10);
  // 10 × (2.5 × 10/20) = 12.5
  assert.equal(override, 12.5);
});
