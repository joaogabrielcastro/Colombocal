const test = require("node:test");
const assert = require("node:assert/strict");
const {
  medirDivergenciaCliente,
  TOLERANCIA_PADRAO,
} = require("../src/services/financeiroDivergencias");

test("medirDivergenciaCliente: alinhados = sem divergência", () => {
  const m = medirDivergenciaCliente({
    clienteId: 1,
    totalDebitos: 1000,
    totalCreditos: 400,
    titulos: [{ valorOriginal: 1000, valorPago: 400 }],
  });
  assert.equal(m.divergente, false);
  assert.equal(m.contaCorrente, 600);
  assert.equal(m.titulosEmAberto, 600);
  assert.equal(m.diferenca, 0);
});

test("medirDivergenciaCliente: títulos acima da conta corrente", () => {
  const m = medirDivergenciaCliente({
    clienteId: 2,
    totalDebitos: 500,
    totalCreditos: 500,
    titulos: [{ valorOriginal: 200, valorPago: 0 }],
  });
  assert.equal(m.divergente, true);
  assert.equal(m.contaCorrente, 0);
  assert.equal(m.titulosEmAberto, 200);
  assert.equal(m.diferenca, 200);
});

test("medirDivergenciaCliente: tolerância padrão", () => {
  const m = medirDivergenciaCliente({
    clienteId: 3,
    totalDebitos: 100,
    totalCreditos: 0,
    titulos: [{ valorOriginal: 100.005, valorPago: 0 }],
  });
  assert.equal(m.divergente, false);
  assert.ok(TOLERANCIA_PADRAO >= 0.01);
});

test("medirDivergenciaCliente: frete avulso pendente alinha com título sem venda", () => {
  // Caso SOFFCOLOR: venda 11293,83 + frete 5430 = títulos 16723,83
  const m = medirDivergenciaCliente({
    clienteId: 4,
    totalDebitos: 11293.83,
    totalCreditos: 0,
    totalFretesAvulsosPendentes: 5430,
    titulos: [
      { valorOriginal: 11293.83, valorPago: 0 },
      { valorOriginal: 5430, valorPago: 0 },
    ],
  });
  assert.equal(m.divergente, false);
  assert.equal(m.contaCorrente, 16723.83);
  assert.equal(m.titulosEmAberto, 16723.83);
  assert.equal(m.fretesAvulsosPendentes, 5430);
});

test("medirDivergenciaCliente: sem frete na conta ainda diverge (legado)", () => {
  const m = medirDivergenciaCliente({
    clienteId: 5,
    totalDebitos: 11293.83,
    totalCreditos: 0,
    titulos: [
      { valorOriginal: 11293.83, valorPago: 0 },
      { valorOriginal: 5430, valorPago: 0 },
    ],
  });
  assert.equal(m.divergente, true);
  assert.equal(m.diferenca, 5430);
});
