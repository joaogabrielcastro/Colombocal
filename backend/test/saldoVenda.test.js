const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularSaldoAbertoVenda,
  splitValorComTroco,
} = require("../src/domain/financeiro/saldoVenda");

test("calcularSaldoAbertoVenda: positivo = em aberto (títulos − pagos)", () => {
  const saldo = calcularSaldoAbertoVenda({
    valorTotal: 1000,
    titulos: [{ valorOriginal: 500 }, { valorOriginal: 500 }],
    pagamentos: [{ valor: 300 }],
  });
  assert.equal(saldo, 700);
});

test("calcularSaldoAbertoVenda: quitada quando pago cobre títulos", () => {
  assert.equal(
    calcularSaldoAbertoVenda({
      titulos: [{ valorOriginal: 200 }],
      pagamentos: [{ valor: 200 }],
    }),
    0,
  );
});

test("calcularSaldoAbertoVenda: sem títulos usa valorTotal (legado)", () => {
  assert.equal(
    calcularSaldoAbertoVenda({
      valorTotal: 400,
      titulos: [],
      pagamentos: [{ valor: 100 }],
    }),
    300,
  );
});

test("calcularSaldoAbertoVenda: nunca negativo se pago excede", () => {
  assert.equal(
    calcularSaldoAbertoVenda({
      titulos: [{ valorOriginal: 100 }],
      pagamentos: [{ valor: 150 }],
    }),
    0,
  );
});

test("splitValorComTroco", () => {
  assert.deepEqual(splitValorComTroco(80, 100), {
    valorPrincipal: 80,
    trocoValor: 0,
  });
  assert.deepEqual(splitValorComTroco(120, 100), {
    valorPrincipal: 100,
    trocoValor: 20,
  });
});
