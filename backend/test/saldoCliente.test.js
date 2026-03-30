const test = require("node:test");
const assert = require("node:assert/strict");
const {
  saldoAbertoNoTitulo,
  totalTitulosEmAberto,
  saldoContaCorrente,
  resumoFinanceiroCliente,
} = require("../src/domain/financeiro/saldoCliente");

test("saldoAbertoNoTitulo soma corretamente", () => {
  assert.equal(saldoAbertoNoTitulo({ valorOriginal: 100, valorPago: 30 }), 70);
  assert.equal(saldoAbertoNoTitulo({ valorOriginal: 50, valorPago: 50 }), 0);
});

test("totalTitulosEmAberto agrega vários títulos", () => {
  const t = [
    { valorOriginal: 100, valorPago: 40 },
    { valorOriginal: 200, valorPago: 0 },
  ];
  assert.equal(totalTitulosEmAberto(t), 260);
});

test("saldoContaCorrente: créditos − débitos", () => {
  assert.equal(saldoContaCorrente(1000, 800), -200);
  assert.equal(saldoContaCorrente(500, 600), 100);
});

test("resumoFinanceiroCliente une conta corrente e títulos", () => {
  const r = resumoFinanceiroCliente({
    totalDebitos: 1000,
    totalCreditos: 400,
    titulos: [{ valorOriginal: 600, valorPago: 0 }],
  });
  assert.equal(r.contaCorrente.saldo, -600);
  assert.equal(r.titulosReceber.emAberto, 600);
  assert.ok(r.contaCorrente.ajuda.length > 10);
  assert.ok(r.titulosReceber.ajuda.length > 10);
});
