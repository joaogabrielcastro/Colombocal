const test = require("node:test");
const assert = require("node:assert/strict");
const {
  comissaoPorEmissao,
  comissaoPorCaixa,
} = require("../src/services/comissao");

test("comissão emissão usa valor da venda", () => {
  assert.equal(
    comissaoPorEmissao({ comissaoValor: 100 }),
    100,
  );
});

test("comissão emissão: comissaoValor zero recalcula pelo percentual aplicado", () => {
  assert.equal(
    comissaoPorEmissao({
      valorTotal: 1000,
      comissaoValor: 0,
      comissaoPercentualAplicado: 5,
    }),
    50,
  );
});

test("comissão caixa proporcional ao pago", () => {
  const v = { valorTotal: 1000, comissaoValor: 50 };
  const pags = [{ valor: 500 }];
  assert.equal(comissaoPorCaixa(v, pags), 25);
  assert.equal(comissaoPorCaixa(v, [{ valor: 1000 }]), 50);
  assert.equal(comissaoPorCaixa(v, []), 0);
});
