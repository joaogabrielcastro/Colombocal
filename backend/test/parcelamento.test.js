const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  dividirValorIgual,
  calcularVencimentos,
  montarParcelas,
  normalizarDiasParcelas,
} = require("../src/domain/financeiro/parcelamento");

describe("parcelamento", () => {
  it("R$ 100 / 15/30/45 → 33,33 + 33,33 + 33,34", () => {
    const valores = dividirValorIgual(100, 3);
    assert.deepEqual(valores, [33.33, 33.33, 33.34]);
    const soma = valores.reduce((a, b) => a + b, 0);
    assert.equal(Number(soma.toFixed(2)), 100);
  });

  it("R$ 10000 / 5 parcelas iguais", () => {
    const valores = dividirValorIgual(10000, 5);
    assert.deepEqual(valores, [2000, 2000, 2000, 2000, 2000]);
  });

  it("vencimentos em dias corridos", () => {
    const base = new Date(Date.UTC(2026, 8, 18, 12, 0, 0));
    const vencs = calcularVencimentos(base, [15, 30, 45]);
    assert.equal(vencs[0].toISOString().slice(0, 10), "2026-10-03");
    assert.equal(vencs[1].toISOString().slice(0, 10), "2026-10-18");
    assert.equal(vencs[2].toISOString().slice(0, 10), "2026-11-02");
  });

  it("montarParcelas com numero VENDA-n-p/q", () => {
    const base = new Date(Date.UTC(2026, 8, 18, 12, 0, 0));
    const parcelas = montarParcelas({
      valorTotal: 100,
      dias: [15, 30, 45],
      dataBase: base,
      numeroVenda: 42,
    });
    assert.equal(parcelas.length, 3);
    assert.equal(parcelas[0].numero, "VENDA-42-1/3");
    assert.equal(parcelas[2].valor, 33.34);
    assert.equal(parcelas[2].parcelaNumero, 3);
    assert.equal(parcelas[2].parcelaTotal, 3);
  });

  it("à vista = [0]", () => {
    assert.deepEqual(normalizarDiasParcelas("À vista"), [0]);
    assert.deepEqual(normalizarDiasParcelas("15/30/45"), [15, 30, 45]);
  });

  it("parcela única mantém numero VENDA-n", () => {
    const base = new Date(Date.UTC(2026, 8, 18, 12, 0, 0));
    const parcelas = montarParcelas({
      valorTotal: 50,
      dias: [30],
      dataBase: base,
      numeroVenda: 7,
    });
    assert.equal(parcelas[0].numero, "VENDA-7");
  });
});
