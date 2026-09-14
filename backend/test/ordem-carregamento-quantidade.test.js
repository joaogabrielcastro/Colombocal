const test = require("node:test");
const assert = require("node:assert/strict");
const { quantidadeEmSacos } = require("../src/domain/frete/calcularFrete");

test("OC: produto em saco não converte", () => {
  assert.equal(
    quantidadeEmSacos({ quantidade: 160, unidade: "saco", pesoKg: 25 }),
    160,
  );
  assert.equal(
    quantidadeEmSacos({
      quantidade: 160,
      produto: { unidade: "SAC", pesoKg: 25 },
    }),
    160,
  );
});

test("OC: produto em ton sem pesoKg usa saco 20 kg (160 t = 8.000 sacos)", () => {
  assert.equal(quantidadeEmSacos({ quantidade: 160, unidade: "ton" }), 8000);
  assert.equal(
    quantidadeEmSacos({
      quantidade: 160,
      produto: { nome: "DOLOMITA M-325", unidade: "ton", pesoKg: null },
    }),
    8000,
  );
});

test("OC: produto em ton com saco 25 kg (4 t = 160 sacos)", () => {
  assert.equal(
    quantidadeEmSacos({ quantidade: 4, unidade: "ton", pesoKg: 25 }),
    160,
  );
  assert.equal(
    quantidadeEmSacos({
      quantidade: 4,
      produto: { unidade: "ton", pesoKg: 25 },
    }),
    160,
  );
});

test("OC: produto em kg divide pelo peso do saco", () => {
  assert.equal(
    quantidadeEmSacos({ quantidade: 4000, unidade: "kg", pesoKg: 25 }),
    160,
  );
});

test("OC: quantidade inválida vira 0", () => {
  assert.equal(quantidadeEmSacos({ quantidade: 0, unidade: "saco" }), 0);
  assert.equal(quantidadeEmSacos({ quantidade: -1, unidade: "ton" }), 0);
});
