const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseMoney,
  comissaoAlvoTotalOrdem,
  comissaoPorEmissao,
  comissaoPorCaixa,
  agregarComissoesPorVendedor,
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

test("parseMoney lida com valores inválidos e nulos", () => {
  assert.equal(parseMoney(undefined), 0);
  assert.equal(parseMoney(null), 0);
  assert.equal(parseMoney("abc"), 0);
  assert.equal(parseMoney("12.5"), 12.5);
  assert.equal(parseMoney(7), 7);
});

test("comissaoAlvoTotalOrdem retorna 0 sem total ou percentual", () => {
  assert.equal(comissaoAlvoTotalOrdem({ valorTotal: 0, comissaoValor: 0 }), 0);
  assert.equal(
    comissaoAlvoTotalOrdem({ valorTotal: 1000, comissaoValor: 0, comissaoPercentualAplicado: 0 }),
    0,
  );
});

test("comissaoPorCaixa retorna 0 quando total da venda é zero", () => {
  assert.equal(comissaoPorCaixa({ valorTotal: 0, comissaoValor: 10 }, [{ valor: 5 }]), 0);
});

test("comissaoPorCaixa limita ratio a 100% quando pago excede total", () => {
  const v = { valorTotal: 1000, comissaoValor: 80 };
  assert.equal(comissaoPorCaixa(v, [{ valor: 5000 }]), 80);
});

test("agregarComissoesPorVendedor agrupa por vendedor nos dois modos", () => {
  const vendas = [
    { id: 1, vendedorId: 10, valorTotal: 1000, comissaoValor: 50 },
    { id: 2, vendedorId: 10, valorTotal: 500, comissaoValor: 25 },
    { id: 3, vendedorId: 20, valorTotal: 200, comissaoValor: 10 },
  ];
  const pags = new Map([
    [1, [{ valor: 500 }]],
    [2, []],
  ]);

  const emissao = agregarComissoesPorVendedor(vendas, pags, "emissao");
  assert.equal(emissao.get(10).comissao, 75);
  assert.equal(emissao.get(10).count, 2);
  assert.equal(emissao.get(10).totalVendas, 1500);
  assert.equal(emissao.get(20).comissao, 10);

  const caixa = agregarComissoesPorVendedor(vendas, pags, "caixa");
  assert.equal(caixa.get(10).comissao, 25);
  assert.equal(caixa.get(20).comissao, 0);
});
