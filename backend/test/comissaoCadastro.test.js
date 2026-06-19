const test = require("node:test");
const assert = require("node:assert/strict");
const {
  percentualPadraoCliente,
  resolverPercentualProduto,
  calcularComissaoParaVenda,
} = require("../src/services/comissaoCadastro");

test("percentual padrão usa comissão fixa do cliente", () => {
  assert.equal(
    percentualPadraoCliente({ comissaoFixaPercentual: 7.5 }, { comissaoPercentual: 3 }),
    7.5,
  );
});

test("percentual padrão cai no representante sem fixa no cliente", () => {
  assert.equal(
    percentualPadraoCliente({ comissaoFixaPercentual: null }, { comissaoPercentual: 4 }),
    4,
  );
});

test("resolve comissão específica por produto", () => {
  const map = new Map([[10, 12]]);
  assert.equal(
    resolverPercentualProduto(10, {}, { comissaoPercentual: 3 }, map),
    12,
  );
  assert.equal(
    resolverPercentualProduto(99, {}, { comissaoPercentual: 3 }, map),
    3,
  );
});

test("calcula comissão por item e média ponderada na venda", () => {
  const map = new Map([[1, 10]]);
  const { comissaoValor, comissaoPercentualAplicado, itensComComissao } =
    calcularComissaoParaVenda({
      itens: [
        { produtoId: 1, quantidade: 2, precoUnitario: 100 },
        { produtoId: 2, quantidade: 1, precoUnitario: 200 },
      ],
      cliente: { comissaoFixaPercentual: null },
      vendedor: { comissaoPercentual: 5 },
      comissaoPorProdutoMap: map,
    });

  assert.equal(itensComComissao[0].comissaoPercentualAplicado, 10);
  assert.equal(itensComComissao[0].comissaoValor, 20);
  assert.equal(itensComComissao[1].comissaoPercentualAplicado, 5);
  assert.equal(itensComComissao[1].comissaoValor, 10);
  assert.equal(comissaoValor, 30);
  assert.equal(comissaoPercentualAplicado, 7.5);
});
