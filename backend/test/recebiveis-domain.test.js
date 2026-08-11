const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EPS,
  aplicarPagamentoNosTitulos,
} = require("../src/domain/financeiro/recebiveis");

test("EPS usado como tolerância de centavos", () => {
  assert.ok(EPS < 0.02);
  assert.ok(EPS > 0);
});

function makeTx(titulos) {
  const updates = [];
  return {
    updates,
    tituloReceber: {
      async findMany({ where }) {
        return titulos.filter((t) => {
          if (where.clienteId != null && t.clienteId !== where.clienteId) return false;
          if (where.vendaId != null && typeof where.vendaId === "object") {
            if (where.vendaId.not != null && t.vendaId === where.vendaId.not) return false;
          } else if (where.vendaId != null && t.vendaId !== where.vendaId) {
            return false;
          }
          if (where.status?.in && !where.status.in.includes(t.status)) return false;
          return true;
        });
      },
      async update({ where, data }) {
        const t = titulos.find((x) => x.id === where.id);
        Object.assign(t, data);
        updates.push({ id: where.id, ...data });
        return t;
      },
    },
  };
}

test("pagamento com vendaId não baixa títulos de outras vendas", async () => {
  const titulos = [
    {
      id: 1,
      clienteId: 10,
      vendaId: 5,
      valorOriginal: 100,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-01"),
    },
    {
      id: 2,
      clienteId: 10,
      vendaId: 6,
      valorOriginal: 80,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-02"),
    },
  ];
  const tx = makeTx(titulos);

  await aplicarPagamentoNosTitulos(tx, {
    clienteId: 10,
    vendaId: 5,
    valor: 150,
  });

  assert.equal(titulos[0].status, "quitado");
  assert.equal(titulos[0].valorPago, 100);
  assert.equal(titulos[1].status, "aberto");
  assert.equal(titulos[1].valorPago, 0);
});

test("pagamento sem vendaId baixa títulos do cliente por vencimento", async () => {
  const titulos = [
    {
      id: 1,
      clienteId: 10,
      vendaId: 5,
      valorOriginal: 40,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-01"),
    },
    {
      id: 2,
      clienteId: 10,
      vendaId: 6,
      valorOriginal: 40,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-02"),
    },
  ];
  const tx = makeTx(titulos);

  await aplicarPagamentoNosTitulos(tx, {
    clienteId: 10,
    vendaId: null,
    valor: 50,
  });

  assert.equal(titulos[0].status, "quitado");
  assert.equal(titulos[0].valorPago, 40);
  assert.equal(titulos[1].status, "parcial");
  assert.equal(titulos[1].valorPago, 10);
});
