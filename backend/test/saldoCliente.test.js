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

test("saldoContaCorrente: debitos - creditos, nunca negativo", () => {
  assert.equal(saldoContaCorrente(1000, 800), 200);
  assert.equal(saldoContaCorrente(500, 600), 0);
});

test("resumoFinanceiroCliente: títulos são SSOT; conta corrente é auxiliar", () => {
  const r = resumoFinanceiroCliente({
    totalDebitos: 1000,
    totalCreditos: 400,
    titulos: [{ valorOriginal: 600, valorPago: 0 }],
  });
  assert.equal(r.contaCorrente.saldo, 600);
  assert.equal(r.titulosReceber.emAberto, 600);
  assert.match(r.contaCorrente.rotulo, /auxiliar/i);
  assert.match(r.titulosReceber.ajuda, /verdade/i);
});
